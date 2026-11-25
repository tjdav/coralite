import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeKeyword } from './csv.js'

const STOPWORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'don',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'get',
  'got',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'know',
  'let',
  'like',
  'make',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'really',
  'right',
  'said',
  'same',
  'she',
  'should',
  'so',
  'some',
  'something',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'thing',
  'things',
  'think',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'us',
  'very',
  'want',
  'was',
  'way',
  'we',
  'well',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves'
])

/**
 * Lists transcript files in a directory.
 * @param {string} directory - Transcript directory.
 * @returns {string[]} Matching file names.
 */
export function listTranscriptFiles (directory) {
  try {
    return readdirSync(directory)
      .filter(file => /\.(md|txt)$/i.test(file) && !/^readme\.md$/i.test(file))
      .sort()
  } catch {
    return []
  }
}

/**
 * Reads every transcript into memory.
 * @param {string} directory - Transcript directory.
 * @returns {Array<{ file: string, text: string }>} Transcript contents.
 */
export function readTranscripts (directory) {
  return listTranscriptFiles(directory).map(file => ({
    file,
    text: readFileSync(join(directory, file), 'utf8')
  }))
}

/**
 * Splits text into lowercase word tokens.
 * @param {string} text - Source text.
 * @returns {string[]} Tokens.
 */
export function tokenize (text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !/^\d+$/.test(token))
}

/**
 * Extracts repeated multi-word phrases from transcripts for editorial review.
 * @param {Array<{ file: string, text: string }>} transcripts - Transcript contents.
 * @param {{ minCount?: number, maxCandidates?: number }} [options={}] - Extraction options.
 * @returns {Array<{ phrase: string, count: number, files: string[] }>} Ranked candidate phrases.
 */
export function extractTranscriptCandidates (transcripts, options = {}) {
  const minCount = options.minCount || 2
  const maxCandidates = options.maxCandidates || 100
  const counts = new Map()

  for (const transcript of transcripts) {
    const tokens = tokenize(transcript.text)
    for (let size = 2; size <= 5; size++) {
      for (let index = 0; index <= tokens.length - size; index++) {
        const phraseTokens = tokens.slice(index, index + size)
        if (STOPWORDS.has(phraseTokens[0]) || STOPWORDS.has(phraseTokens[phraseTokens.length - 1])) {
          continue
        }
        if (phraseTokens.some(token => STOPWORDS.has(token))) {
          continue
        }
        const phrase = phraseTokens.join(' ')
        if (!counts.has(phrase)) {
          counts.set(phrase, {
            count: 0,
            files: new Set()
          })
        }
        const entry = counts.get(phrase)
        entry.count += 1
        entry.files.add(transcript.file)
      }
    }
  }

  const ranked = [...counts.entries()]
    .map(([phrase, entry]) => ({
      phrase,
      tokens: phrase.split(' '),
      count: entry.count,
      files: [...entry.files]
    }))
    .filter(candidate => candidate.count >= minCount)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }
      return right.tokens.length - left.tokens.length
    })

  const kept = []
  for (const candidate of ranked) {
    const covered = kept.some(entry => entry.count >= candidate.count &&
      entry.tokens.length > candidate.tokens.length &&
      entry.tokens.join(' ').includes(candidate.tokens.join(' '))
    )
    if (!covered) {
      kept.push(candidate)
    }
    if (kept.length >= maxCandidates) {
      break
    }
  }

  return kept.map(({ phrase, count, files }) => ({
    phrase,
    count,
    files
  }))
}

/**
 * Counts how often a topic keyword appears in the transcript corpus.
 * @param {string} corpus - Normalised transcript text.
 * @param {string} keyword - Topic keyword.
 * @returns {number} Occurrence count.
 */
export function countMentions (corpus, keyword) {
  const needle = normalizeKeyword(keyword)
  if (!needle || !corpus) {
    return 0
  }
  let count = 0
  let index = corpus.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = corpus.indexOf(needle, index + needle.length)
  }
  return count
}

/**
 * Counts transcript mentions for every seed keyword.
 * @param {Array<{ keyword: string }>} topics - Seed topics.
 * @param {Array<{ text: string }>} transcripts - Transcript contents.
 * @returns {Record<string, number>} Mention counts by keyword.
 */
export function collectTranscriptMentions (topics, transcripts) {
  const corpus = normalizeKeyword(transcripts.map(transcript => transcript.text).join('\n'))
  /** @type {Record<string, number>} */
  const mentions = {}
  for (const topic of topics) {
    mentions[topic.keyword] = countMentions(corpus, topic.keyword)
  }
  return mentions
}

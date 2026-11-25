const STATUS_ORDER = ['ready', 'needs-docs', 'needs-evidence', 'needs-data', 'skip']

/**
 * Formats a number for Markdown tables.
 * @param {number} value - Numeric value.
 * @returns {string} Display value.
 */
function displayNumber (value) {
  return Number.isFinite(value) && value > 0 ? String(value) : '—'
}

/**
 * Renders one Markdown table row.
 * @param {object} topic - Scored topic.
 * @returns {string} Markdown row.
 */
function tableRow (topic) {
  const signals = topic.demandSignals
  return [
    topic.rank,
    topic.keyword,
    topic.score,
    topic.status,
    topic.action,
    displayNumber(signals.volume),
    displayNumber(signals.communityMentions),
    displayNumber(signals.serpDensity),
    topic.serpWeakness,
    topic.coverage === 'canonical' ? 'yes' : topic.coverage,
    topic.format,
    topic.cluster
  ].join(' | ')
}

/**
 * Builds the header row for the opportunity table.
 * @returns {string} Markdown table header.
 */
function tableHeader () {
  return [
    '#',
    'Topic',
    'Score',
    'Status',
    'Action',
    'Volume',
    'Community',
    'SERP density',
    'SERP weakness',
    'Docs',
    'Format',
    'Cluster'
  ].join(' | ')
}

/**
 * Builds the full Markdown backlog report.
 * @param {{ generatedAt: string, settings: object, topics: Array<object> }} payload - Report payload.
 * @returns {string} Markdown report.
 */
export function buildBacklogMarkdown (payload) {
  const { generatedAt, settings, topics } = payload
  const counts = {}
  for (const status of STATUS_ORDER) {
    counts[status] = 0
  }
  for (const topic of topics) {
    counts[topic.status] = (counts[topic.status] || 0) + 1
  }

  const lines = [
    '# Coralite content backlog',
    '',
    `Generated ${generatedAt} by \`website/scripts/topic-research.js\`. Do not edit by hand; update the seed catalog or re-run \`score\`.`,
    '',
    '## Summary',
    ''
  ]

  for (const status of STATUS_ORDER) {
    lines.push(`- **${status}**: ${counts[status]}`)
  }

  lines.push(
    '',
    '## Settings',
    '',
    `- Keyword Planner volumes: ${settings.keywordVolumes ? 'yes' : 'missing'}`,
    `- Search Console rows: ${settings.searchConsoleRows || 0}`,
    `- Community rows: ${settings.communityRows || 0}`,
    `- SERP rows: ${settings.serpRows || 0}`,
    `- Transcript mentions: ${settings.transcriptRows || 0}`,
    `- Docs pages scanned: ${settings.docsPages || 0}`,
    `- Blog posts scanned: ${settings.blogPosts || 0} (${settings.blogReleases || 0} releases)`,
    '',
    'Demand combines volume, Search Console impressions, community mentions and SERP density. Missing signals are dropped and the remaining weights renormalised, so a topic is only `ready` when at least one demand signal exists.',
    '',
    '## Opportunities',
    '',
    `| ${tableHeader()} |`,
    `| ${new Array(12).fill('---').join(' | ')} |`
  )

  for (const topic of topics) {
    lines.push(`| ${tableRow(topic)} |`)
  }

  const strategic = topics.filter(topic => topic.strategic && topic.rank > 10).slice(0, 15)
  lines.push(
    '',
    '## Strategic blind spots outside the top 10',
    '',
    'Curated topics that should be covered even when the SERP is competitive. They are listed separately so a demand-driven ranking does not bury them.',
    ''
  )
  if (strategic.length === 0) {
    lines.push('_None._')
  } else {
    lines.push(
      `| ${tableHeader()} |`,
      `| ${new Array(12).fill('---').join(' | ')} |`
    )
    for (const topic of strategic) {
      lines.push(`| ${tableRow(topic)} |`)
    }
  }

  const docsGaps = topics.filter(topic => topic.blockers.includes('needs-docs'))
  lines.push('', '## Docs gaps (write the page first)', '')
  if (docsGaps.length === 0) {
    lines.push('_None._')
  } else {
    lines.push('| Topic | Suggested page | Evidence |', '| --- | --- | --- |')
    for (const topic of docsGaps) {
      lines.push(`| ${topic.keyword} | ${topic.docs || 'new dedicated page'} | ${topic.evidence.length > 0 ? topic.evidence.join(', ') : 'needs evidence'} |`)
    }
  }

  const needsData = topics.filter(topic => topic.blockers.includes('needs-data'))
  lines.push('', '## Needs demand data', '')
  if (needsData.length === 0) {
    lines.push('_None._')
  } else {
    lines.push(needsData.map(topic => `- ${topic.keyword}`).join('\n'))
  }

  const transcripts = topics.filter(topic => topic.source === 'transcript')
  lines.push('', '## Transcript-sourced candidates', '')
  if (transcripts.length === 0) {
    lines.push('_No transcript candidates yet. Drop transcripts in `website/data/topics/transcripts/` and run `extract:transcripts`._')
  } else {
    lines.push(transcripts.map(topic => `- ${topic.keyword} (mentions: ${topic.demandSignals.transcriptMentions})`).join('\n'))
  }

  return `${lines.join('\n')}\n`
}

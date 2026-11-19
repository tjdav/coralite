# Open Graph fonts

`inter-400.ttf` and `inter-700.ttf` are static subsets of the self-hosted
variable font at `public/fonts/inter-variable.woff2`. Satori cannot read WOFF2,
so the two weights used by the cards are instanced, subset to Latin plus the
punctuation the cards use, and stored as TTF.

Regenerate them from the repository root:

```bash
cd website
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

SRC = 'public/fonts/inter-variable.woff2'
unicodes = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [
    0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A,
    0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030,
    0x2039, 0x203A, 0x2044, 0x20AC, 0x2192, 0x00B7
]
for weight in (400, 700):
    font = instantiateVariableFont(TTFont(SRC), {'wght': weight}, inplace=True, updateFontNames=True)
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_legacy = True
    options.layout_features = ['*']
    options.notdef_outline = True
    options.recalc_bounds = True
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    font.flavor = None
    font.save(f'src/og/fonts/inter-{weight}.ttf')
PY
```

Inter is licensed under the SIL Open Font License 1.1. See `OFL.txt` in this
directory. JetBrains Mono is not used by the cards.

# lumeland/benchmark Integration for Coralite

This directory contains the integration wrapper for running Coralite in the [`lumeland/benchmark`](https://github.com/lumeland/benchmark) harness (the standard Static Site Generator benchmark suite).

## How It Works

1. The `lumeland/benchmark` harness generates Markdown (`.md`) content files in the `content/` directory.
2. `build.js` converts each Markdown file into a HTML page (`pages/<slug>.html`) wrapped in minimal HTML markup.
3. `build.js` invokes `coralite build` to compile the generated HTML pages into static output in `dist/`.

## Running locally against `lumeland/benchmark`

To run this integration within the `lumeland/benchmark` repository:

1. Clone the `lumeland/benchmark` repository:
   ```bash
   git clone https://github.com/lumeland/benchmark.git
   cd benchmark
   ```

2. Copy this `coralite` directory into the benchmark repository's `ssg/` directory:
   ```bash
   cp -r /path/to/coralite/benchmarks/lumeland-benchmark/coralite ssg/coralite
   ```

3. Run the benchmark suite using Deno (or as configured in `lumeland/benchmark`):
   ```bash
   deno task bench
   ```

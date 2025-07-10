# DeepGuide CLI


![Demo status](https://github.com/DeepGuide-Ai/dg/actions/workflows/dg-validate.yml/badge.svg) [![npm version](https://badge.fury.io/js/@deepguide-ai%2Fdg.svg)](https://www.npmjs.com/package/@deepguide-ai/dg) [![CI Status](https://github.com/deepguide-ai/dg/workflows/CI/badge.svg)](https://github.com/deepguide-ai/dg/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Transform your CLI documentation from static code blocks or heavy GIF/Video into **self-testing, interactive, lightweight demos** that stay current automatically.

## Use `dg` to capture your terminal session

> Captured using `dg`. We dogfood ourselves.

<!--Remove one image if your site handles dark-mode automatically-->
![Capture - light](/.dg/svg/capture-light.svg#gh-light-mode-only)
![Capture - dark](/.dg/svg/capture-dark.svg#gh-dark-mode-only)


## Installation

### Via npm (recommended)

```bash
# Install globally
sudo npm install -g @deepguide-ai/dg

# Or run without installing
npx @deepguide-ai/dg init
```

### Requirements

- **Node.js 18+** - The CLI runs on Node.js
- **termsvg** - For recording terminal sessions (auto-installed on first use)

### Verify Installation

```bash
dg doctor
```

This will check that all dependencies are properly installed.

**Quick Start** 

```bash
npx @deepguide-ai/dg init  # 30-second setup
dg capture                 # Record interactive demo
dg validate                # Test in CI - PR fails if broken
```


## Core Commands

| Command | Purpose | Example |
|---------|---------|---------|
| **`dg init`** | Interactive setup wizard | `npx @deepguide-ai/dg init` |
| **`dg capture`** | Record CLI demos | `dg capture` |
| **`dg validate`** | Test demos in CI | `dg validate` |
| **`dg list`** | Show status | `dg list` |
| **`dg doctor`** | Environment diagnostics | `dg doctor` |


## FAQ

### **Q: How does validation work?**  
**A:** DG re-runs your original commands and compares exit codes + filtered output. Interactive demos are automatically skipped in CI.

### **Q: What platforms are supported?**
**A:** All platforms supported by Node.js 18+: macOS, Linux. Requires Node.js runtime. Windows is supported through WSL.

### **Q: How big are the generated assets?**
**A:** SVG demos are typically 50-100x smaller than equivalent GIFs.

## Examples in the Wild

See DG in action:
- **[Demo](https://github.com/deepguide-ai/dg-demo)** - Demo Project for dg

*Want your project listed? [Open a PR!](https://github.com/deepguide/dg/pulls)*

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md).

### Development Setup

```bash
git clone https://github.com/deepguide-ai/dg.git
cd dg
pnpm install
pnpm run build
pnpm run dev
```

### Testing

```bash
pnpm test              # Unit tests (when available)
pnpm run build         # Build TypeScript
node dist/index.js    # Test built CLI
```

## Support

- 🐛 **[Issues](https://github.com/deepguide/dg/issues)** - Bug reports and feature requests
- 💬 **[Discussions](https://github.com/deepguide/dg/discussions)** - Questions and community
- 📧 **[Email](mailto:support@deepguide.ai)** - Direct support

## Credits

DeepGuide CLI builds upon these amazing open source projects:

- **[asciinema](https://github.com/asciinema/asciinema)** - The core terminal session recorder that powers our demo capture. GPL-3.0 licensed.
- **[node-pty](https://github.com/microsoft/node-pty)** - Pseudoterminal implementation that enables cross-platform terminal recording. MIT licensed.
- **[termsvg](https://github.com/MrMarble/termsvg)** - Terminal session to SVG renderer that creates our lightweight, beautiful demo outputs. GPL-3.0 licensed.

Special thanks to the maintainers and contributors of these projects! ❤️

## License

**MIT** - The main CLI tool is MIT licensed for maximum compatibility.

Platform packages containing termsvg binaries are **GPL-3.0** licensed. Enterprise users can avoid GPL binaries with `DG_GPL_OFF=1`.

---

**Made with ❤️ by the [DeepGuide](https://deepguide.ai) team**

*Transform your CLI documentation from static to spectacular.* 
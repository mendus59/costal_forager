# App icon source

The scallop icon is drawn as SVG by `gen.py` and rendered to PNG with the preinstalled Chromium by `render.cjs`:

```sh
cd apps/mobile/assets/icon-source
python3 gen.py && node render.cjs
```

Then copy the PNGs into `../images` at the sizes listed in `app.json` (icon 1024, adaptive layers 512, monochrome 432, favicon 48; for the monochrome layer, make white transparent).

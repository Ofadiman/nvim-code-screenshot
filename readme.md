# Nvim Codeshot

Nvim Codeshot is a plugin that allows you to take a screenshot of the code in the file you are currently working in.

## Requirements

- Neovim@0.9.0
- NodeJS@20

## Installation

Codeshot can be installed using any package manager. Here is an example of installation using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
require("lazy").setup({
  {
    "Ofadiman/nvim-codeshot",
    -- Install latest chrome browser required for puppeteer.
    build = ":lua require('nvim-codeshot').install()"
  },
})
```

After installation, you can configure a keyboard shortcut that invokes the screenshot command.

```lua
vim.keymap.set("v", "<leader>ua", function()
  vim.cmd(":CodeshotScreenshot")
end, { noremap = true, silent = true, nowait = true })
```

## Configuration

```lua
require("nvim-codeshot").setup({
  -- Setting this option to `true` will cause the screenshot to contain the path to the file where the screenshot was taken.
  breadcrumbs = true,
  padding = {
    -- Allows to configure the amount of horizontal padding.
    horizontal = 10,
    -- Allows to configure the amount of vertical padding.
    vertical = 10,
  },
  html = {
    -- Allows to completely override default html template used for generating screenshots.
    template = "",
    -- Allows to add a watermark to the page that renders the code.
    watermark = "",
    -- Allows to add additional styles to the page that renders the code.
    styles = "",
  },
  whitespace = {
    -- Setting this option to `false` will result in the extra whitespace not being removed from the code at screenshot time.
    trim = true,
    -- Allows to set the indentation width for code that uses tabs for indentations.
    tab_width = 2,
  },
  output = {
    -- Setting this option to `true` will cause the screenshot to be saved to the file system. Screenshot by default is only copied to clipboard.
    enable = false,
    -- Path to the folder with screenshots.
    directory = "~/.codeshot",
    -- Allows to format screenshot filename using lua function. Screenshot file names will by default follow `filename.extension` format (e.g. `readme.md.png`).
    -- For example, if you want to have `readme.md_2024_05_26_13:22:06.png` filename format, you have to add custom formatting function that would look like this:
    -- formatter = function(filename)
    --   return filename .. "_" .. os.date("%Y_%m_%d_%H:%M:%S")
    -- end,
    formatter = function(filename)
      return filename
    end,
  },
  clipboard = {
    -- Setting this option to `false` will cause the screenshot not being copied to the clipboard.
    enable = true,
    -- Allows to configure command which will be used to copy image to clipboard. The plugin currently supports the following clipboard managers:
    -- * xclip (command: `xclip -selection clipboard -t image/png -i %s`)
    -- If you are using unlisted clipboard manager you have to configure the script used to copy the image by yourself.
    command = nil,
  },
  -- Allows to configure theme used for making screenshots. The full list of themes is available here: https://shiki.style/themes
  theme = "catppuccin-mocha",
  -- Allows to configure screenshot extension. Currently supported extensions are `webp`, `jpeg` and `png`.
  extension = "png",
  -- Allows to customize screenshot scale.
  scale = 3,
  aliases = {
    -- Allows to set language aliases so that, for example, files with extension `.ofa` are treated as files with extension `.js` when taking a screenshot. Available language aliases: https://shiki.style/languages
    languages = nil,
    -- Allows to set file aliases so that, for example, files without extension (like Makefile) can be interpreted correctly when taking a screenshot. Available language aliases: https://shiki.style/languages
    files = nil,
  },
})
```

## Similar projects

- [carbon-now-sh.nvim](https://github.com/cameronviner/carbon-now-sh.nvim)
- [codesnap.nvim](https://github.com/mistricky/codesnap.nvim)
- [silicon.nvim](https://github.com/krivahtoo/silicon.nvim)

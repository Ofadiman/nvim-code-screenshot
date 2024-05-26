local M = {
  options = {
    -- Setting this option to `true` will cause the program to emit additional logs when taking screenshots. The option comes in handy when debugging problems with the plugin.
    debug = false,
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
    -- Allows you to set the language alias. Available language aliases: https://shiki.style/languages
    languages = nil,
  },
}

-- NOTE: This function is required to sanitize options passed to vim.fn.json_encode from unserializable data types (e.g. functions).
local function sanitize_table_for_serialization(original_table)
  local sanitized_table = vim.deepcopy(original_table)

  local function sanitize(inner_table)
    for key, value in pairs(inner_table) do
      if type(value) == "function" or type(value) == "userdata" then
        inner_table[key] = nil
      elseif type(value) == "table" then
        sanitize(value)
      end
    end
  end

  sanitize(sanitized_table)

  return sanitized_table
end

vim.api.nvim_create_user_command("CodeshotSetup", function()
  local plugin_dir = debug.getinfo(1, "S").source:sub(2):match("(.*[/\\])")
  local setup_script = plugin_dir .. "../bin/setup.cjs"

  local handle = io.popen("node " .. setup_script)
  if handle ~= nil then
    local result = handle:read("*a")
    handle:close()

    print(result)
  end
end, {})

vim.api.nvim_create_user_command("CodeshotScreenshot", function()
  if M.options.clipboard.enable == false and M.options.output.enable == false then
    if M.options.debug == true then
      print("Both \"clipboard.enable\" and \"output.enable\" options are set to \"false\", so this command does nothing right now.")
    end
    return
  end

  local start_line = vim.fn.getpos("v")[2]
  local end_line = vim.fn.getpos(".")[2]
  local lines = {}

  local is_selecting_from_top_to_bottom = start_line < end_line
  if is_selecting_from_top_to_bottom then
    lines = vim.api.nvim_buf_get_lines(0, start_line - 1, end_line, false)
  else
    lines = vim.api.nvim_buf_get_lines(0, end_line - 1, start_line, false)
  end

  local code = table.concat(lines, "\n")

  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", true)

  local args = vim.tbl_deep_extend("error", M.options, {
    code = code,
    filepath = vim.fn.expand("%"),
    output = {
      filename = M.options.output.formatter(vim.fn.expand("%:t")),
    },
  })
  local directory = debug.getinfo(1, "S").source:sub(2):match("(.*[/\\])")
  local script = directory .. "../bin/screenshot.cjs"
  local json = vim.fn.json_encode(sanitize_table_for_serialization(args))

  local tempFile = os.tmpname() .. ".json"
  local file = io.open(tempFile, "w")
  if file then
    file:write(json)
    file:close()
  else
    error("Failed to open file for writing: " .. tempFile)
  end

  -- NOTE: If I do not redirect stderr to stdout then the logs from stderr (e.g. `console.error`) are appended at the end of the current buffer.
  local handle = io.popen("node " .. script .. " " .. tempFile .. " 2>&1")
  if handle ~= nil then
    local result = handle:read("*a")
    handle:close()
    print(result)
  end
end, {})

M.setup = function(options)
  local merged_options = vim.tbl_deep_extend("force", M.options, options)
  M.options = merged_options
end

return M

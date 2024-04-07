local M = {
  options = {
    debug = false,
    padding = {
      horizontal = 10,
      vertical = 10,
    },
    html = {
      template = nil,
      watermark = nil,
    },
    output = {
      enable = false,
      directory = "~/.codeshot",
      formatter = function(filename)
        return filename
      end,
    },
    clipboard = {
      enable = true,
      command = nil,
    },
    -- Available themes: https://shiki.style/themes
    theme = "catppuccin-mocha",
    extension = "png",
    quality = 3,
    -- Available language aliases: https://shiki.style/languages
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

  local start_pos = vim.fn.getpos("v")
  local end_pos = vim.fn.getpos(".")

  local start_line, start_col = start_pos[2], start_pos[3]
  local end_line, end_col = end_pos[2], end_pos[3]

  local lines = vim.api.nvim_buf_get_lines(0, start_line - 1, end_line, false)

  if vim.fn.visualmode() == "V" or vim.fn.visualmode() == "" then
    lines[#lines] = vim.api.nvim_buf_get_lines(0, end_line - 1, end_line, false)[1]
  else
    if #lines == 1 then
      lines[1] = string.sub(lines[1], start_col, end_col)
    else
      lines[#lines] = string.sub(lines[#lines], 1, end_col)
      lines[1] = string.sub(lines[1], start_col)
    end
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

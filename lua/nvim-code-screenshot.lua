local M = {
  options = {
    padding = 10,
    persist = {
      enable = false,
      path = "~/",
    },
    clipboard = {
      enable = true,
      -- TODO: I am not sure if this is the best way to copy image to clipboard.
      program = "xclip",
    },
    -- Available themes: https://shiki.style/themes
    theme = "material",
    extension = "webp",
    quality = 3,
    -- Available language aliases: https://shiki.style/languages
    languages = {},
  },
}

vim.api.nvim_create_user_command("CodeScreenshotSetup", function()
  local plugin_dir = debug.getinfo(1, "S").source:sub(2):match("(.*[/\\])")
  local install_script = plugin_dir .. "../bin/install.cjs"

  local handle = io.popen("node " .. install_script)
  if handle ~= nil then
    local result = handle:read("*a")
    handle:close()

    print(result)
  end
end, {})

vim.api.nvim_create_user_command("CodeScreenshotScreenshot", function()
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

  print("Selected Text:")
  print(vim.inspect(code))

  print("File path:")
  print(vim.fn.expand("%"))
end, {})

M.setup = function(options)
  local merged_options = vim.tbl_deep_extend("force", M.options, options)
  M.options = merged_options
  print(vim.inspect(M.options))
end

return M

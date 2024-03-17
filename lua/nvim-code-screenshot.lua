local M = {}

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

M.setup = function() end

return M

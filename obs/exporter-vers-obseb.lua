--[[
  OBSeb : bouton « Exporter vers OBSeb » pour OBS Studio.
  Outils > Scripts > + > choisir ce fichier.

  Le bouton copie la collection de scènes en cours (scènes, sources, positions)
  et tous les fichiers qu'elle utilise (images, vidéos, musiques, pages HTML)
  dans un dossier d'export. Claude transforme ensuite ce dossier en thème OBSeb.
  Les captures (caméra, PS5, fenêtres, écran) et les plugins ne sont pas exportables :
  ils sont listés dans le rapport.
]]
local obs = obslua
local dossier_export = ""

local EXPORTABLES = {
  image_source = "file", ffmpeg_source = "local_file", browser_source = "local_file",
  vlc_source = nil, slideshow = nil, slideshow_v2 = nil,
}
local NON_EXPORTABLES = {
  dshow_input = "caméra", av_capture_input = "caméra", game_capture = "capture de jeu",
  window_capture = "capture de fenêtre", monitor_capture = "capture d'écran",
  wasapi_input_capture = "micro", wasapi_output_capture = "son du PC", wasapi_process_output_capture = "son d'une appli",
}

function script_description()
  return "<b>Exporter vers OBSeb</b><br>Copie la collection de scènes en cours et ses fichiers dans un dossier, pour la transformer en thème OBSeb."
end

function script_properties()
  local p = obs.obs_properties_create()
  obs.obs_properties_add_path(p, "dossier", "Dossier d'export", obs.OBS_PATH_DIRECTORY, "", nil)
  obs.obs_properties_add_button(p, "exporter", "Exporter vers OBSeb", function() exporter() return false end)
  return p
end

function script_defaults(s)
  obs.obs_data_set_default_string(s, "dossier", os.getenv("USERPROFILE") .. "\\Videos\\SEBASTIAN\\SEBASTIAN Ciné Série\\OBSeb\\Exports")
end

function script_update(s)
  dossier_export = obs.obs_data_get_string(s, "dossier")
end

local function nom_propre(s)
  return (s:gsub("[^%w%-_ ]", "_"))
end

-- Les fonctions d'OBS gèrent les chemins avec accents sous Windows (« Ciné »), pas io.open
local function copier(src, dst)
  if obs.os_copyfile then return obs.os_copyfile(src, dst) == 0 end
  local a = io.open(src, "rb"); if not a then return false end
  local b = io.open(dst, "wb"); if not b then a:close() return false end
  while true do local bloc = a:read(1048576); if not bloc then break end; b:write(bloc) end
  a:close(); b:close(); return true
end

local function mkdir(chemin)
  if obs.os_mkdirs then obs.os_mkdirs(chemin) else os.execute('mkdir "' .. chemin .. '" 2>nul') end
end

local function existe(chemin)
  if obs.os_file_exists then return obs.os_file_exists(chemin) end
  local t = io.open(chemin, "r"); if t then t:close() return true end; return false
end

local function ecrire(chemin, texte)
  if obs.os_quick_write_utf8_file then return obs.os_quick_write_utf8_file(chemin, texte, #texte, true) end
  local r = io.open(chemin, "w"); if r then r:write(texte); r:close() end
end

function exporter()
  local collection = obs.obs_frontend_get_current_scene_collection()
  local appdata = os.getenv("APPDATA")
  local fichier_json = nil
  -- le fichier de la collection porte le nom de la collection (caractères spéciaux remplacés par OBS)
  local candidats = { collection, (collection:gsub(" ", "_")) }
  for _, c in ipairs(candidats) do
    local f = appdata .. "\\obs-studio\\basic\\scenes\\" .. c .. ".json"
    if existe(f) then fichier_json = f break end
  end
  if not fichier_json then
    obs.script_log(obs.LOG_WARNING, "Collection introuvable : " .. collection)
    return
  end

  local horodatage = os.date("%Y-%m-%d_%Hh%M")
  local cible = dossier_export .. "\\" .. nom_propre(collection) .. "_" .. horodatage
  mkdir(dossier_export); mkdir(cible); mkdir(cible .. "\\fichiers")
  copier(fichier_json, cible .. "\\collection.json")

  local rapport = { "Export OBSeb de « " .. collection .. " » le " .. os.date("%d/%m/%Y à %H:%M"), "" }
  local data = obs.obs_data_create_from_json_file(fichier_json)
  local sources = obs.obs_data_get_array(data, "sources")
  local n = obs.obs_data_array_count(sources)
  local copies, ignores = 0, 0
  for i = 0, n - 1 do
    local src = obs.obs_data_array_item(sources, i)
    local id = obs.obs_data_get_string(src, "id")
    local nom = obs.obs_data_get_string(src, "name")
    local reglages = obs.obs_data_get_obj(src, "settings")
    local champ = EXPORTABLES[id]
    if champ then
      local chemin = obs.obs_data_get_string(reglages, champ)
      if chemin ~= "" then
        local base = chemin:match("[^\\/]+$") or ("fichier" .. i)
        if copier(chemin, cible .. "\\fichiers\\" .. base) then
          copies = copies + 1
          table.insert(rapport, "OK      " .. nom .. " (" .. id .. ") : " .. base)
        else
          table.insert(rapport, "ABSENT  " .. nom .. " : fichier introuvable " .. chemin)
        end
      end
    elseif NON_EXPORTABLES[id] then
      ignores = ignores + 1
      table.insert(rapport, "IGNORÉ  " .. nom .. " : " .. NON_EXPORTABLES[id] .. " (reste sur ton PC)")
    end
    obs.obs_data_release(reglages)
    obs.obs_data_release(src)
  end
  obs.obs_data_array_release(sources)
  obs.obs_data_release(data)

  table.insert(rapport, "")
  table.insert(rapport, copies .. " fichier(s) copié(s), " .. ignores .. " source(s) non exportable(s).")
  table.insert(rapport, "Dis à Claude : « importe l'export " .. nom_propre(collection) .. "_" .. horodatage .. " dans OBSeb ».")
  ecrire(cible .. "\\rapport.txt", table.concat(rapport, "\r\n"))
  obs.script_log(obs.LOG_INFO, "Export OBSeb terminé : " .. cible)
  os.execute('explorer "' .. cible .. '"')
end

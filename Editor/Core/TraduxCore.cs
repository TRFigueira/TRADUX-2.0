using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using TRADUX.Editor.Models;

namespace TRADUX.Editor.Core
{
    /// <summary>
    /// Core system for TRADUX translation tool
    /// </summary>
    public static class TraduxCore
    {
        private static TraduxSettings settings;
        private static TraduxDatabase database;
        private static bool isInitialized = false;

        public static TraduxSettings Settings => settings;
        public static TraduxDatabase Database => database;

        /// <summary>
        /// Initialize TRADUX core systems
        /// </summary>
        public static void Initialize()
        {
            if (isInitialized) return;

            Debug.Log("[TRADUX] Initializing core systems...");

            // Load or create settings
            LoadSettings();

            // Initialize database
            InitializeDatabase();

            // Setup asset processors
            SetupAssetProcessors();

            isInitialized = true;
            Debug.Log("[TRADUX] Core systems initialized successfully");
        }

        private static void LoadSettings()
        {
            string settingsPath = Path.Combine(Application.dataPath, "..", "ProjectSettings", "TraduxSettings.json");
            
            if (File.Exists(settingsPath))
            {
                try
                {
                    string json = File.ReadAllText(settingsPath);
                    settings = JsonSerializer.Deserialize<TraduxSettings>(json);
                    Debug.Log("[TRADUX] Settings loaded from file");
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"[TRADUX] Failed to load settings: {e.Message}");
                    settings = CreateDefaultSettings();
                }
            }
            else
            {
                settings = CreateDefaultSettings();
                SaveSettings();
            }
        }

        private static TraduxSettings CreateDefaultSettings()
        {
            return new TraduxSettings
            {
                autoExtractOnImport = true,
                supportedFileExtensions = new List<string> { ".txt", ".json", ".csv", ".xml", ".yaml", ".yml" },
                translationAPISettings = new TranslationAPISettings
                {
                    provider = "Google",
                    apiKey = "",
                    autoTranslate = false
                },
                extractionSettings = new ExtractionSettings
                {
                    includeScriptableObject = true,
                    includePrefabs = true,
                    includeScenes = true,
                    includeScripts = false
                },
                qualitySettings = new QualitySettings
                {
                    checkTextOverflow = true,
                    checkMissingTranslations = true,
                    checkConsistency = true
                }
            };
        }

        private static void InitializeDatabase()
        {
            string databasePath = Path.Combine(Application.dataPath, "..", "ProjectSettings", "TraduxDatabase.json");
            database = new TraduxDatabase(databasePath);
            database.Initialize();
        }

        private static void SetupAssetProcessors()
        {
            // Register asset processors for different file types
            AssetProcessorRegistry.RegisterProcessor(".json", new JsonAssetProcessor());
            AssetProcessorRegistry.RegisterProcessor(".csv", new CsvAssetProcessor());
            AssetProcessorRegistry.RegisterProcessor(".xml", new XmlAssetProcessor());
            AssetProcessorRegistry.RegisterProcessor(".txt", new TextAssetProcessor());
            AssetProcessorRegistry.RegisterProcessor(".assets", new UnityAssetProcessor());
        }

        /// <summary>
        /// Save current settings
        /// </summary>
        public static void SaveSettings()
        {
            if (settings == null) return;

            string settingsPath = Path.Combine(Application.dataPath, "..", "ProjectSettings", "TraduxSettings.json");
            
            try
            {
                string json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(settingsPath, json);
                Debug.Log("[TRADUX] Settings saved");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Failed to save settings: {e.Message}");
            }
        }

        /// <summary>
        /// Get project information
        /// </summary>
        public static ProjectInfo GetProjectInfo()
        {
            return new ProjectInfo
            {
                projectName = PlayerSettings.productName,
                unityVersion = Application.unityVersion,
                targetPlatform = EditorUserBuildSettings.activeBuildTarget.ToString(),
                projectPath = Application.dataPath,
                traduxVersion = "2.0.0"
            };
        }

        /// <summary>
        /// Scan project for translatable assets
        /// </summary>
        public static List<TranslatableAsset> ScanProject()
        {
            List<TranslatableAsset> assets = new List<TranslatableAsset>();
            string projectPath = Application.dataPath;

            // Scan all supported file types
            foreach (string extension in settings.supportedFileExtensions)
            {
                string[] files = Directory.GetFiles(projectPath, $"*{extension}", SearchOption.AllDirectories);
                
                foreach (string file in files)
                {
                    if (ShouldSkipFile(file)) continue;

                    var asset = CreateTranslatableAsset(file);
                    if (asset != null)
                    {
                        assets.Add(asset);
                    }
                }
            }

            // Scan Unity assets
            if (settings.extractionSettings.includeScriptableObject)
            {
                ScanUnityAssets(assets);
            }

            return assets;
        }

        private static bool ShouldSkipFile(string filePath)
        {
            // Skip files in common non-translatable directories
            string[] skipDirectories = { "Editor", "Plugins", "Resources", "StreamingAssets" };
            
            foreach (string dir in skipDirectories)
            {
                if (filePath.Contains($"\\{dir}\\") || filePath.Contains($"/{dir}/"))
                {
                    return true;
                }
            }

            // Skip hidden files
            return Path.GetFileName(filePath).StartsWith(".");
        }

        private static TranslatableAsset CreateTranslatableAsset(string filePath)
        {
            string relativePath = Path.GetRelativePath(Application.dataPath, filePath);
            string extension = Path.GetExtension(filePath);
            
            return new TranslatableAsset
            {
                path = relativePath,
                fullPath = filePath,
                fileName = Path.GetFileName(filePath),
                extension = extension,
                size = new FileInfo(filePath).Length,
                lastModified = File.GetLastWriteTime(filePath),
                isUnityAsset = false
            };
        }

        private static void ScanUnityAssets(List<TranslatableAsset> assets)
        {
            // Scan for ScriptableObjects
            if (settings.extractionSettings.includeScriptableObject)
            {
                string[] scriptableObjects = AssetDatabase.FindAssets("t:ScriptableObject");
                foreach (string guid in scriptableObjects)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guid);
                    var asset = CreateTranslatableAsset(Path.Combine(Application.dataPath, "..", path));
                    if (asset != null)
                    {
                        asset.isUnityAsset = true;
                        asset.assetType = "ScriptableObject";
                        assets.Add(asset);
                    }
                }
            }

            // Scan for Prefabs
            if (settings.extractionSettings.includePrefabs)
            {
                string[] prefabs = AssetDatabase.FindAssets("t:Prefab");
                foreach (string guid in prefabs)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guid);
                    var asset = CreateTranslatableAsset(Path.Combine(Application.dataPath, "..", path));
                    if (asset != null)
                    {
                        asset.isUnityAsset = true;
                        asset.assetType = "Prefab";
                        assets.Add(asset);
                    }
                }
            }

            // Scan for Scenes
            if (settings.extractionSettings.includeScenes)
            {
                string[] scenes = AssetDatabase.FindAssets("t:Scene");
                foreach (string guid in scenes)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guid);
                    var asset = CreateTranslatableAsset(Path.Combine(Application.dataPath, "..", path));
                    if (asset != null)
                    {
                        asset.isUnityAsset = true;
                        asset.assetType = "Scene";
                        assets.Add(asset);
                    }
                }
            }
        }
    }
}

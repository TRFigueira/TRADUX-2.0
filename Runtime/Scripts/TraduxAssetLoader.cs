using UnityEngine;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace TRADUX.Runtime.Core
{
    /// <summary>
    /// Manages loading of translation assets
    /// </summary>
    public class TraduxAssetLoader
    {
        private Dictionary<string, TextAsset> loadedAssets;
        private string assetsPath = "Tradux/Locales";

        public TraduxAssetLoader()
        {
            loadedAssets = new Dictionary<string, TextAsset>();
        }

        /// <summary>
        /// Load translation assets for a specific language
        /// </summary>
        public async Task<bool> LoadLanguageAssets(string languageCode)
        {
            string assetPath = $"{assetsPath}/{languageCode}";
            
            try
            {
                // Load from Resources
                var textAsset = Resources.Load<TextAsset>(assetPath);
                if (textAsset != null)
                {
                    loadedAssets[languageCode] = textAsset;
                    TraduxRuntime.Localization.LoadTranslationsFromResources(assetPath);
                    return true;
                }
                else
                {
                    Debug.LogWarning($"[TRADUX Runtime] No translation asset found for language: {languageCode}");
                    return false;
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX Runtime] Error loading language assets: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Load all available language assets
        /// </summary>
        public async Task<int> LoadAllLanguageAssets()
        {
            int loadedCount = 0;
            var availableLanguages = TraduxRuntime.Language.GetAvailableLanguages();
            
            foreach (var language in availableLanguages)
            {
                string languageCode = TraduxRuntime.Language.GetLanguageCode(language);
                if (await LoadLanguageAssets(languageCode))
                {
                    loadedCount++;
                }
            }
            
            Debug.Log($"[TRADUX Runtime] Loaded {loadedCount} language asset files");
            return loadedCount;
        }

        /// <summary>
        /// Unload language assets
        /// </summary>
        public void UnloadLanguageAssets(string languageCode)
        {
            if (loadedAssets.ContainsKey(languageCode))
            {
                loadedAssets.Remove(languageCode);
                Resources.UnloadAsset(loadedAssets[languageCode]);
            }
        }

        /// <summary>
        /// Check if language assets are loaded
        /// </summary>
        public bool IsLanguageLoaded(string languageCode)
        {
            return loadedAssets.ContainsKey(languageCode);
        }

        /// <summary>
        /// Get loaded language assets
        /// </summary>
        public Dictionary<string, TextAsset> GetLoadedAssets()
        {
            return new Dictionary<string, TextAsset>(loadedAssets);
        }

        /// <summary>
        /// Set custom assets path
        /// </summary>
        public void SetAssetsPath(string path)
        {
            assetsPath = path;
        }
    }
}

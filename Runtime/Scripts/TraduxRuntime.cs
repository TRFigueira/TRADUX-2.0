using UnityEngine;
using System.Collections.Generic;
using System.IO;
using TRADUX.Runtime.Models;

namespace TRADUX.Runtime.Core
{
    /// <summary>
    /// Core runtime system for TRADUX translation
    /// </summary>
    public static class TraduxRuntime
    {
        private static TraduxLocalizationManager localizationManager;
        private static TraduxLanguageManager languageManager;
        private static TraduxAssetLoader assetLoader;
        private static bool isInitialized = false;

        public static TraduxLocalizationManager Localization => localizationManager;
        public static TraduxLanguageManager Language => languageManager;
        public static TraduxAssetLoader Assets => assetLoader;

        /// <summary>
        /// Initialize TRADUX runtime systems
        /// </summary>
        public static void Initialize()
        {
            if (isInitialized) return;

            Debug.Log("[TRADUX Runtime] Initializing runtime systems...");

            // Initialize managers
            localizationManager = new TraduxLocalizationManager();
            languageManager = new TraduxLanguageManager();
            assetLoader = new TraduxAssetLoader();

            // Load configuration
            LoadConfiguration();

            // Set default language
            languageManager.SetCurrentLanguage(SystemLanguage.English);

            isInitialized = true;
            Debug.Log("[TRADUX Runtime] Runtime systems initialized successfully");
        }

        /// <summary>
        /// Get localized text
        /// </summary>
        public static string GetText(string key, params object[] args)
        {
            if (!isInitialized) Initialize();
            return localizationManager.GetText(key, args);
        }

        /// <summary>
        /// Get localized text with fallback
        /// </summary>
        public static string GetText(string key, string fallback, params object[] args)
        {
            if (!isInitialized) Initialize();
            return localizationManager.GetText(key, fallback, args);
        }

        /// <summary>
        /// Change current language
        /// </summary>
        public static void SetLanguage(SystemLanguage language)
        {
            if (!isInitialized) Initialize();
            languageManager.SetCurrentLanguage(language);
        }

        /// <summary>
        /// Change current language by code
        /// </summary>
        public static void SetLanguage(string languageCode)
        {
            if (!isInitialized) Initialize();
            languageManager.SetCurrentLanguage(languageCode);
        }

        /// <summary>
        /// Get current language
        /// </summary>
        public static SystemLanguage GetCurrentLanguage()
        {
            if (!isInitialized) Initialize();
            return languageManager.GetCurrentLanguage();
        }

        /// <summary>
        /// Get all available languages
        /// </summary>
        public static List<SystemLanguage> GetAvailableLanguages()
        {
            if (!isInitialized) Initialize();
            return languageManager.GetAvailableLanguages();
        }

        /// <summary>
        /// Load translations from file
        /// </summary>
        public static void LoadTranslations(string filePath)
        {
            if (!isInitialized) Initialize();
            localizationManager.LoadTranslations(filePath);
        }

        /// <summary>
        /// Load translations from Resources
        /// </summary>
        public static void LoadTranslationsFromResources(string resourcePath)
        {
            if (!isInitialized) Initialize();
            localizationManager.LoadTranslationsFromResources(resourcePath);
        }

        /// <summary>
        /// Register text component for automatic translation
        /// </summary>
        public static void RegisterTextComponent(ITraduxTextComponent component)
        {
            if (!isInitialized) Initialize();
            localizationManager.RegisterTextComponent(component);
        }

        /// <summary>
        /// Unregister text component
        /// </summary>
        public static void UnregisterTextComponent(ITraduxTextComponent component)
        {
            if (!isInitialized) Initialize();
            localizationManager.UnregisterTextComponent(component);
        }

        private static void LoadConfiguration()
        {
            // Load configuration from Resources or create default
            var config = Resources.Load<TraduxConfiguration>("TraduxConfiguration");
            
            if (config != null)
            {
                ApplyConfiguration(config);
            }
            else
            {
                CreateDefaultConfiguration();
            }
        }

        private static void ApplyConfiguration(TraduxConfiguration config)
        {
            languageManager.SetDefaultLanguage(config.defaultLanguage);
            languageManager.SetAvailableLanguages(config.availableLanguages);
            localizationManager.SetFallbackLanguage(config.fallbackLanguage);
        }

        private static void CreateDefaultConfiguration()
        {
            Debug.Log("[TRADUX Runtime] Using default configuration");
            
            // Set default available languages
            var defaultLanguages = new List<SystemLanguage>
            {
                SystemLanguage.English,
                SystemLanguage.Spanish,
                SystemLanguage.French,
                SystemLanguage.German,
                SystemLanguage.Italian,
                SystemLanguage.Japanese,
                SystemLanguage.Korean,
                SystemLanguage.Chinese,
                SystemLanguage.Russian,
                SystemLanguage.Portuguese
            };
            
            languageManager.SetAvailableLanguages(defaultLanguages);
        }
    }
}

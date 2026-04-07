using UnityEngine;
using System.Collections.Generic;
using System;

namespace TRADUX.Runtime.Core
{
    /// <summary>
    /// Manages language switching and language-related operations
    /// </summary>
    public class TraduxLanguageManager
    {
        private SystemLanguage currentLanguage;
        private SystemLanguage defaultLanguage = SystemLanguage.English;
        private List<SystemLanguage> availableLanguages;
        private Dictionary<SystemLanguage, string> languageCodes;

        public TraduxLanguageManager()
        {
            availableLanguages = new List<SystemLanguage>();
            languageCodes = new Dictionary<SystemLanguage, string>();
            
            InitializeLanguageCodes();
            SetCurrentLanguage(Application.systemLanguage);
        }

        /// <summary>
        /// Set current language
        /// </summary>
        public void SetCurrentLanguage(SystemLanguage language)
        {
            if (currentLanguage != language)
            {
                currentLanguage = language;
                Debug.Log($"[TRADUX Runtime] Language changed to: {language}");
                
                // Notify all components to update
                TraduxRuntime.Localization.UpdateAllComponents();
                
                // Trigger language change event
                OnLanguageChanged?.Invoke(language);
            }
        }

        /// <summary>
        /// Set current language by language code
        /// </summary>
        public void SetCurrentLanguage(string languageCode)
        {
            SystemLanguage language = GetLanguageFromCode(languageCode);
            SetCurrentLanguage(language);
        }

        /// <summary>
        /// Get current language
        /// </summary>
        public SystemLanguage GetCurrentLanguage()
        {
            return currentLanguage;
        }

        /// <summary>
        /// Get current language code
        /// </summary>
        public string GetCurrentLanguageCode()
        {
            return GetLanguageCode(currentLanguage);
        }

        /// <summary>
        /// Get available languages
        /// </summary>
        public List<SystemLanguage> GetAvailableLanguages()
        {
            return new List<SystemLanguage>(availableLanguages);
        }

        /// <summary>
        /// Set available languages
        /// </summary>
        public void SetAvailableLanguages(List<SystemLanguage> languages)
        {
            availableLanguages = new List<SystemLanguage>(languages);
            
            // Ensure current language is in available languages
            if (!availableLanguages.Contains(currentLanguage))
            {
                SetCurrentLanguage(defaultLanguage);
            }
        }

        /// <summary>
        /// Add available language
        /// </summary>
        public void AddAvailableLanguage(SystemLanguage language)
        {
            if (!availableLanguages.Contains(language))
            {
                availableLanguages.Add(language);
            }
        }

        /// <summary>
        /// Remove available language
        /// </summary>
        public bool RemoveAvailableLanguage(SystemLanguage language)
        {
            bool removed = availableLanguages.Remove(language);
            
            // If removing current language, switch to default
            if (removed && currentLanguage == language)
            {
                SetCurrentLanguage(defaultLanguage);
            }
            
            return removed;
        }

        /// <summary>
        /// Set default language
        /// </summary>
        public void SetDefaultLanguage(SystemLanguage language)
        {
            defaultLanguage = language;
            
            // Add to available languages if not present
            if (!availableLanguages.Contains(language))
            {
                AddAvailableLanguage(language);
            }
        }

        /// <summary>
        /// Get language code from SystemLanguage
        /// </summary>
        public string GetLanguageCode(SystemLanguage language)
        {
            return languageCodes.TryGetValue(language, out string code) ? code : "en";
        }

        /// <summary>
        /// Get SystemLanguage from language code
        /// </summary>
        public SystemLanguage GetLanguageFromCode(string languageCode)
        {
            foreach (var kvp in languageCodes)
            {
                if (kvp.Value.Equals(languageCode, StringComparison.OrdinalIgnoreCase))
                {
                    return kvp.Key;
                }
            }
            
            return defaultLanguage;
        }

        /// <summary>
        /// Check if language is available
        /// </summary>
        public bool IsLanguageAvailable(SystemLanguage language)
        {
            return availableLanguages.Contains(language);
        }

        /// <summary>
        /// Get language display name
        /// </summary>
        public string GetLanguageDisplayName(SystemLanguage language)
        {
            switch (language)
            {
                case SystemLanguage.English: return "English";
                case SystemLanguage.Spanish: return "Español";
                case SystemLanguage.French: return "Français";
                case SystemLanguage.German: return "Deutsch";
                case SystemLanguage.Italian: return "Italiano";
                case SystemLanguage.Japanese: return "Japanese";
                case SystemLanguage.Korean: return "Korean";
                case SystemLanguage.Chinese: return "Chinese";
                case SystemLanguage.Russian: return "Russian";
                case SystemLanguage.Portuguese: return "Português";
                default: return language.ToString();
            }
        }

        /// <summary>
        /// Get language display name from code
        /// </summary>
        public string GetLanguageDisplayName(string languageCode)
        {
            SystemLanguage language = GetLanguageFromCode(languageCode);
            return GetLanguageDisplayName(language);
        }

        /// <summary>
        /// Event triggered when language changes
        /// </summary>
        public event Action<SystemLanguage> OnLanguageChanged;

        private void InitializeLanguageCodes()
        {
            languageCodes[SystemLanguage.English] = "en";
            languageCodes[SystemLanguage.Spanish] = "es";
            languageCodes[SystemLanguage.French] = "fr";
            languageCodes[SystemLanguage.German] = "de";
            languageCodes[SystemLanguage.Italian] = "it";
            languageCodes[SystemLanguage.Japanese] = "ja";
            languageCodes[SystemLanguage.Korean] = "ko";
            languageCodes[SystemLanguage.Chinese] = "zh";
            languageCodes[SystemLanguage.Russian] = "ru";
            languageCodes[SystemLanguage.Portuguese] = "pt";
            languageCodes[SystemLanguage.ChineseSimplified] = "zh-CN";
            languageCodes[SystemLanguage.ChineseTraditional] = "zh-TW";
        }
    }
}

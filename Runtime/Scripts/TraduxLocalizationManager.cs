using UnityEngine;
using System.Collections.Generic;
using System.Collections;
using TRADUX.Runtime.Models;

namespace TRADUX.Runtime.Core
{
    /// <summary>
    /// Manages text localization and translation
    /// </summary>
    public class TraduxLocalizationManager
    {
        private Dictionary<string, Dictionary<string, string>> translations;
        private Dictionary<string, ITraduxTextComponent> registeredComponents;
        private string fallbackLanguage = "en";
        private bool autoUpdateComponents = true;

        public TraduxLocalizationManager()
        {
            translations = new Dictionary<string, Dictionary<string, string>>();
            registeredComponents = new Dictionary<string, ITraduxTextComponent>();
        }

        /// <summary>
        /// Get localized text
        /// </summary>
        public string GetText(string key, params object[] args)
        {
            return GetText(key, key, args);
        }

        /// <summary>
        /// Get localized text with fallback
        /// </summary>
        public string GetText(string key, string fallback, params object[] args)
        {
            string currentLanguage = TraduxRuntime.Language.GetCurrentLanguageCode();
            
            // Try to get translation in current language
            if (translations.TryGetValue(currentLanguage, out var langDict) && 
                langDict.TryGetValue(key, out string translation))
            {
                return string.Format(translation, args);
            }

            // Try fallback language
            if (currentLanguage != fallbackLanguage && 
                translations.TryGetValue(fallbackLanguage, out var fallbackDict) && 
                fallbackDict.TryGetValue(key, out string fallbackTranslation))
            {
                return string.Format(fallbackTranslation, args);
            }

            // Return fallback text
            return string.Format(fallback, args);
        }

        /// <summary>
        /// Check if translation exists
        /// </summary>
        public bool HasTranslation(string key)
        {
            string currentLanguage = TraduxRuntime.Language.GetCurrentLanguageCode();
            
            return translations.TryGetValue(currentLanguage, out var langDict) && 
                   langDict.ContainsKey(key);
        }

        /// <summary>
        /// Load translations from file
        /// </summary>
        public void LoadTranslations(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    string json = File.ReadAllText(filePath);
                    var data = JsonUtility.FromJson<TranslationData>(json);
                    
                    foreach (var entry in data.translations)
                    {
                        AddTranslation(entry.language, entry.key, entry.text);
                    }
                    
                    Debug.Log($"[TRADUX Runtime] Loaded {data.translations.Count} translations from {filePath}");
                    
                    if (autoUpdateComponents)
                    {
                        UpdateAllComponents();
                    }
                }
                else
                {
                    Debug.LogWarning($"[TRADUX Runtime] Translation file not found: {filePath}");
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX Runtime] Error loading translations: {e.Message}");
            }
        }

        /// <summary>
        /// Load translations from Resources
        /// </summary>
        public void LoadTranslationsFromResources(string resourcePath)
        {
            var textAsset = Resources.Load<TextAsset>(resourcePath);
            if (textAsset != null)
            {
                try
                {
                    var data = JsonUtility.FromJson<TranslationData>(textAsset.text);
                    
                    foreach (var entry in data.translations)
                    {
                        AddTranslation(entry.language, entry.key, entry.text);
                    }
                    
                    Debug.Log($"[TRADUX Runtime] Loaded {data.translations.Count} translations from Resources/{resourcePath}");
                    
                    if (autoUpdateComponents)
                    {
                        UpdateAllComponents();
                    }
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"[TRADUX Runtime] Error loading translations from Resources: {e.Message}");
                }
            }
            else
            {
                Debug.LogWarning($"[TRADUX Runtime] Translation asset not found in Resources: {resourcePath}");
            }
        }

        /// <summary>
        /// Add or update translation
        /// </summary>
        public void AddTranslation(string language, string key, string text)
        {
            if (!translations.ContainsKey(language))
            {
                translations[language] = new Dictionary<string, string>();
            }

            translations[language][key] = text;
        }

        /// <summary>
        /// Remove translation
        /// </summary>
        public bool RemoveTranslation(string language, string key)
        {
            if (translations.TryGetValue(language, out var langDict))
            {
                bool removed = langDict.Remove(key);
                if (removed && autoUpdateComponents)
                {
                    UpdateAllComponents();
                }
                return removed;
            }
            return false;
        }

        /// <summary>
        /// Clear all translations for a language
        /// </summary>
        public void ClearTranslations(string language)
        {
            if (translations.Remove(language) && autoUpdateComponents)
            {
                UpdateAllComponents();
            }
        }

        /// <summary>
        /// Clear all translations
        /// </summary>
        public void ClearAllTranslations()
        {
            translations.Clear();
            if (autoUpdateComponents)
            {
                UpdateAllComponents();
            }
        }

        /// <summary>
        /// Get all translations for a language
        /// </summary>
        public Dictionary<string, string> GetTranslations(string language)
        {
            return translations.TryGetValue(language, out var langDict) ? 
                   new Dictionary<string, string>(langDict) : 
                   new Dictionary<string, string>();
        }

        /// <summary>
        /// Register text component for automatic updates
        /// </summary>
        public void RegisterTextComponent(ITraduxTextComponent component)
        {
            if (component != null && !string.IsNullOrEmpty(component.GetTranslationKey()))
            {
                registeredComponents[component.GetTranslationKey()] = component;
                component.UpdateText();
            }
        }

        /// <summary>
        /// Unregister text component
        /// </summary>
        public void UnregisterTextComponent(ITraduxTextComponent component)
        {
            if (component != null)
            {
                registeredComponents.Remove(component.GetTranslationKey());
            }
        }

        /// <summary>
        /// Update all registered components
        /// </summary>
        public void UpdateAllComponents()
        {
            foreach (var component in registeredComponents.Values)
            {
                if (component != null)
                {
                    component.UpdateText();
                }
            }
        }

        /// <summary>
        /// Set fallback language
        /// </summary>
        public void SetFallbackLanguage(string languageCode)
        {
            fallbackLanguage = languageCode;
        }

        /// <summary>
        /// Enable/disable automatic component updates
        /// </summary>
        public void SetAutoUpdateComponents(bool enabled)
        {
            autoUpdateComponents = enabled;
        }

        /// <summary>
        /// Get translation statistics
        /// </summary>
        public TranslationStatistics GetStatistics()
        {
            var stats = new TranslationStatistics();
            
            foreach (var kvp in translations)
            {
                string language = kvp.Key;
                int count = kvp.Value.Count;
                
                if (!stats.translationsByLanguage.ContainsKey(language))
                {
                    stats.translationsByLanguage[language] = 0;
                }
                stats.translationsByLanguage[language] = count;
                stats.totalTranslations += count;
            }

            return stats;
        }
    }

    /// <summary>
    /// Translation data structure
    /// </summary>
    [System.Serializable]
    public class TranslationData
    {
        public List<TranslationEntry> translations;
    }

    /// <summary>
    /// Individual translation entry
    /// </summary>
    [System.Serializable]
    public class TranslationEntry
    {
        public string language;
        public string key;
        public string text;
    }

    /// <summary>
    /// Translation statistics
    /// </summary>
    [System.Serializable]
    public class TranslationStatistics
    {
        public int totalTranslations;
        public Dictionary<string, int> translationsByLanguage;
        
        public TranslationStatistics()
        {
            translationsByLanguage = new Dictionary<string, int>();
        }
    }
}

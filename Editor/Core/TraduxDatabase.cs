using UnityEngine;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using TRADUX.Editor.Models;

namespace TRADUX.Editor.Core
{
    /// <summary>
    /// Database system for TRADUX translation data
    /// </summary>
    public class TraduxDatabase
    {
        private string databasePath;
        private Dictionary<string, TranslatableString> strings;
        private Dictionary<string, TranslatableAsset> assets;
        private Dictionary<string, TranslationMemoryEntry> translationMemory;
        private Dictionary<string, GlossaryTerm> glossary;
        private ProjectInfo projectInfo;
        private bool isInitialized = false;

        public TraduxDatabase(string path)
        {
            databasePath = path;
            strings = new Dictionary<string, TranslatableString>();
            assets = new Dictionary<string, TranslatableAsset>();
            translationMemory = new Dictionary<string, TranslationMemoryEntry>();
            glossary = new Dictionary<string, GlossaryTerm>();
        }

        /// <summary>
        /// Initialize database and load existing data
        /// </summary>
        public void Initialize()
        {
            if (isInitialized) return;

            Debug.Log("[TRADUX] Initializing database...");

            try
            {
                LoadDatabase();
                isInitialized = true;
                Debug.Log("[TRADUX] Database initialized successfully");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Database initialization error: {e.Message}");
                // Create empty database if loading fails
                CreateEmptyDatabase();
                isInitialized = true;
            }
        }

        /// <summary>
        /// Load database from file
        /// </summary>
        private void LoadDatabase()
        {
            if (!File.Exists(databasePath))
            {
                CreateEmptyDatabase();
                return;
            }

            try
            {
                string json = File.ReadAllText(databasePath);
                var database = JsonSerializer.Deserialize<TraduxDatabaseData>(json);
                
                if (database != null)
                {
                    strings = database.strings ?? new Dictionary<string, TranslatableString>();
                    assets = database.assets ?? new Dictionary<string, TranslatableAsset>();
                    translationMemory = database.translationMemory ?? new Dictionary<string, TranslationMemoryEntry>();
                    glossary = database.glossary ?? new Dictionary<string, GlossaryTerm>();
                    projectInfo = database.projectInfo;
                    
                    Debug.Log($"[TRADUX] Database loaded: {strings.Count} strings, {assets.Count} assets");
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Database loading error: {e.Message}");
                throw;
            }
        }

        /// <summary>
        /// Create empty database structure
        /// </summary>
        private void CreateEmptyDatabase()
        {
            strings = new Dictionary<string, TranslatableString>();
            assets = new Dictionary<string, TranslatableAsset>();
            translationMemory = new Dictionary<string, TranslationMemoryEntry>();
            glossary = new Dictionary<string, GlossaryTerm>();
            projectInfo = new ProjectInfo
            {
                projectName = PlayerSettings.productName,
                unityVersion = Application.unityVersion,
                targetPlatform = EditorUserBuildSettings.activeBuildTarget.ToString(),
                projectPath = Application.dataPath,
                traduxVersion = "2.0.0",
                lastScan = System.DateTime.Now,
                totalStrings = 0,
                translatedStrings = 0,
                reviewedStrings = 0
            };

            SaveDatabase();
        }

        /// <summary>
        /// Save database to file
        /// </summary>
        public void SaveDatabase()
        {
            try
            {
                var database = new TraduxDatabaseData
                {
                    strings = strings,
                    assets = assets,
                    translationMemory = translationMemory,
                    glossary = glossary,
                    projectInfo = projectInfo
                };

                string json = JsonSerializer.Serialize(database, new JsonSerializerOptions { WriteIndented = true });
                
                // Ensure directory exists
                string directory = Path.GetDirectoryName(databasePath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                File.WriteAllText(databasePath, json);
                Debug.Log("[TRADUX] Database saved");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Database saving error: {e.Message}");
            }
        }

        /// <summary>
        /// Add or update a translatable string
        /// </summary>
        public void UpsertString(TranslatableString translatableString)
        {
            if (translatableString == null) return;

            strings[translatableString.id] = translatableString;
            UpdateProjectInfo();
        }

        /// <summary>
        /// Get a translatable string by ID
        /// </summary>
        public TranslatableString GetString(string id)
        {
            return strings.TryGetValue(id, out var str) ? str : null;
        }

        /// <summary>
        /// Get all translatable strings
        /// </summary>
        public List<TranslatableString> GetAllStrings()
        {
            return new List<TranslatableString>(strings.Values);
        }

        /// <summary>
        /// Get strings by filter criteria
        /// </summary>
        public List<TranslatableString> GetStrings(StringFilter filter)
        {
            var result = new List<TranslatableString>();

            foreach (var str in strings.Values)
            {
                if (filter.Matches(str))
                {
                    result.Add(str);
                }
            }

            return result;
        }

        /// <summary>
        /// Delete a translatable string
        /// </summary>
        public bool DeleteString(string id)
        {
            bool removed = strings.Remove(id);
            if (removed)
            {
                UpdateProjectInfo();
            }
            return removed;
        }

        /// <summary>
        /// Add or update a translatable asset
        /// </summary>
        public void UpsertAsset(TranslatableAsset asset)
        {
            if (asset == null) return;

            assets[asset.path] = asset;
            UpdateProjectInfo();
        }

        /// <summary>
        /// Get a translatable asset by path
        /// </summary>
        public TranslatableAsset GetAsset(string path)
        {
            return assets.TryGetValue(path, out var asset) ? asset : null;
        }

        /// <summary>
        /// Get all translatable assets
        /// </summary>
        public List<TranslatableAsset> GetAllAssets()
        {
            return new List<TranslatableAsset>(assets.Values);
        }

        /// <summary>
        /// Add translation memory entry
        /// </summary>
        public void AddTranslationMemory(TranslationMemoryEntry entry)
        {
            if (entry == null) return;

            string key = GetTranslationMemoryKey(entry.sourceText, entry.targetLanguage);
            translationMemory[key] = entry;
        }

        /// <summary>
        /// Get translation memory entries
        /// </summary>
        public List<TranslationMemoryEntry> GetTranslationMemory(string sourceText, string targetLanguage)
        {
            var result = new List<TranslationMemoryEntry>();
            string key = GetTranslationMemoryKey(sourceText, targetLanguage);

            if (translationMemory.TryGetValue(key, out var entry))
            {
                result.Add(entry);
            }

            // Also search for partial matches
            foreach (var tm in translationMemory.Values)
            {
                if (tm.targetLanguage == targetLanguage && 
                    tm.sourceText.Contains(sourceText) && 
                    tm.sourceText != sourceText)
                {
                    result.Add(tm);
                }
            }

            return result;
        }

        /// <summary>
        /// Add glossary term
        /// </summary>
        public void AddGlossaryTerm(GlossaryTerm term)
        {
            if (term == null) return;

            string key = GetGlossaryKey(term.sourceTerm, term.targetLanguage);
            glossary[key] = term;
        }

        /// <summary>
        /// Get glossary term
        /// </summary>
        public GlossaryTerm GetGlossaryTerm(string sourceTerm, string targetLanguage)
        {
            string key = GetGlossaryKey(sourceTerm, targetLanguage);
            return glossary.TryGetValue(key, out var term) ? term : null;
        }

        /// <summary>
        /// Get all glossary terms
        /// </summary>
        public List<GlossaryTerm> GetAllGlossaryTerms()
        {
            return new List<GlossaryTerm>(glossary.Values);
        }

        /// <summary>
        /// Get project information
        /// </summary>
        public ProjectInfo GetProjectInfo()
        {
            return projectInfo;
        }

        /// <summary>
        /// Update project information
        /// </summary>
        public void UpdateProjectInfo()
        {
            if (projectInfo == null) return;

            projectInfo.totalStrings = strings.Count;
            projectInfo.translatedStrings = CountTranslatedStrings();
            projectInfo.reviewedStrings = CountReviewedStrings();
            projectInfo.lastScan = System.DateTime.Now;
        }

        /// <summary>
        /// Get translation statistics
        /// </summary>
        public TranslationStatistics GetStatistics()
        {
            var stats = new TranslationStatistics
            {
                totalStrings = strings.Count,
                translatedStrings = CountTranslatedStrings(),
                reviewedStrings = CountReviewedStrings(),
                approvedStrings = CountApprovedStrings()
            };

            if (stats.totalStrings > 0)
            {
                stats.translationProgress = (float)stats.translatedStrings / stats.totalStrings;
                stats.reviewProgress = (float)stats.reviewedStrings / stats.totalStrings;
                stats.approvalProgress = (float)stats.approvedStrings / stats.totalStrings;
            }

            // Calculate strings by language
            stats.stringsByLanguage = new Dictionary<string, int>();
            foreach (var str in strings.Values)
            {
                foreach (var lang in str.translations.Keys)
                {
                    if (stats.stringsByLanguage.ContainsKey(lang))
                    {
                        stats.stringsByLanguage[lang]++;
                    }
                    else
                    {
                        stats.stringsByLanguage[lang] = 1;
                    }
                }
            }

            // Calculate strings by type
            stats.stringsByType = new Dictionary<string, int>();
            foreach (var asset in assets.Values)
            {
                string type = asset.assetType ?? "File";
                if (stats.stringsByType.ContainsKey(type))
                {
                    stats.stringsByType[type] += asset.stringCount;
                }
                else
                {
                    stats.stringsByType[type] = asset.stringCount;
                }
            }

            return stats;
        }

        /// <summary>
        /// Search strings
        /// </summary>
        public List<TranslatableString> SearchStrings(string query, SearchOptions options = null)
        {
            var result = new List<TranslatableString>();
            
            if (string.IsNullOrEmpty(query))
            {
                return GetAllStrings();
            }

            options = options ?? new SearchOptions();

            foreach (var str in strings.Values)
            {
                if (MatchesSearchCriteria(str, query, options))
                {
                    result.Add(str);
                }
            }

            return result;
        }

        /// <summary>
        /// Import strings from extraction result
        /// </summary>
        public void ImportFromExtraction(ExtractionResult extractionResult)
        {
            if (extractionResult?.assets == null) return;

            foreach (var asset in extractionResult.assets)
            {
                UpsertAsset(asset);

                if (asset.strings != null)
                {
                    foreach (var str in asset.strings)
                    {
                        UpsertString(str);
                    }
                }
            }

            SaveDatabase();
        }

        /// <summary>
        /// Export strings to file
        /// </summary>
        public void ExportToFile(string filePath, string language, ExportFormat format = ExportFormat.JSON)
        {
            try
            {
                var exportData = new List<ExportEntry>();

                foreach (var str in strings.Values)
                {
                    var entry = new ExportEntry
                    {
                        id = str.id,
                        key = str.key,
                        sourceText = str.sourceText,
                        context = str.context,
                        translation = str.translations.ContainsKey(language) ? str.translations[language] : ""
                    };

                    exportData.Add(entry);
                }

                string json = JsonSerializer.Serialize(exportData, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filePath, json);

                Debug.Log($"[TRADUX] Exported {exportData.Count} strings to {filePath}");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Export error: {e.Message}");
                throw;
            }
        }

        private string GetTranslationMemoryKey(string sourceText, string targetLanguage)
        {
            return $"{sourceText}_{targetLanguage}";
        }

        private string GetGlossaryKey(string sourceTerm, string targetLanguage)
        {
            return $"{sourceTerm}_{targetLanguage}";
        }

        private int CountTranslatedStrings()
        {
            int count = 0;
            foreach (var str in strings.Values)
            {
                if (str.isTranslated) count++;
            }
            return count;
        }

        private int CountReviewedStrings()
        {
            int count = 0;
            foreach (var str in strings.Values)
            {
                if (str.isReviewed) count++;
            }
            return count;
        }

        private int CountApprovedStrings()
        {
            int count = 0;
            foreach (var str in strings.Values)
            {
                if (str.quality?.score >= 0.8f) count++;
            }
            return count;
        }

        private bool MatchesSearchCriteria(TranslatableString str, string query, SearchOptions options)
        {
            if (options.caseSensitive)
            {
                return str.sourceText.Contains(query) || 
                       str.key.Contains(query) || 
                       str.context.Contains(query);
            }
            else
            {
                return str.sourceText.ToLower().Contains(query.ToLower()) || 
                       str.key.ToLower().Contains(query.ToLower()) || 
                       str.context.ToLower().Contains(query.ToLower());
            }
        }
    }

    /// <summary>
    /// Database data structure for serialization
    /// </summary>
    internal class TraduxDatabaseData
    {
        public Dictionary<string, TranslatableString> strings;
        public Dictionary<string, TranslatableAsset> assets;
        public Dictionary<string, TranslationMemoryEntry> translationMemory;
        public Dictionary<string, GlossaryTerm> glossary;
        public ProjectInfo projectInfo;
    }

    /// <summary>
    /// String filter criteria
    /// </summary>
    public class StringFilter
    {
        public string language;
        public bool isTranslated;
        public bool isReviewed;
        public string assetType;
        public List<string> tags;

        public bool Matches(TranslatableString str)
        {
            if (!string.IsNullOrEmpty(language) && !str.translations.ContainsKey(language))
                return false;

            if (isTranslated && !str.isTranslated)
                return false;

            if (isReviewed && !str.isReviewed)
                return false;

            if (!string.IsNullOrEmpty(assetType) && str.assetPath != assetType)
                return false;

            if (tags != null && tags.Count > 0)
            {
                foreach (string tag in tags)
                {
                    if (!str.tags.Contains(tag))
                        return false;
                }
            }

            return true;
        }
    }

    /// <summary>
    /// Search options
    /// </summary>
    public class SearchOptions
    {
        public bool caseSensitive = false;
        public bool includeTranslations = false;
        public string language;
    }

    /// <summary>
    /// Export entry structure
    /// </summary>
    public class ExportEntry
    {
        public string id;
        public string key;
        public string sourceText;
        public string context;
        public string translation;
    }

    /// <summary>
    /// Export format
    /// </summary>
    public enum ExportFormat
    {
        JSON,
        CSV,
        XML,
        TMX
    }
}

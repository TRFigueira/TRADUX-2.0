using System;
using System.Collections.Generic;

namespace TRADUX.Editor.Models
{
    /// <summary>
    /// Settings for TRADUX translation tool
    /// </summary>
    [Serializable]
    public class TraduxSettings
    {
        public bool autoExtractOnImport;
        public List<string> supportedFileExtensions;
        public TranslationAPISettings translationAPISettings;
        public ExtractionSettings extractionSettings;
        public QualitySettings qualitySettings;
        public List<string> targetLanguages;
        public string defaultSourceLanguage = "en";
    }

    /// <summary>
    /// Translation API settings
    /// </summary>
    [Serializable]
    public class TranslationAPISettings
    {
        public string provider; // Google, DeepL, OpenAI, etc.
        public string apiKey;
        public bool autoTranslate;
        public Dictionary<string, string> languageCodes;
        public int maxRequestsPerMinute = 60;
        public bool useCache = true;
    }

    /// <summary>
    /// Asset extraction settings
    /// </summary>
    [Serializable]
    public class ExtractionSettings
    {
        public bool includeScriptableObject;
        public bool includePrefabs;
        public bool includeScenes;
        public bool includeScripts;
        public bool extractFromComponents = true;
        public bool extractFromUI = true;
        public bool extractFromAudio = false;
        public List<string> excludePaths;
        public List<string> includePaths;
    }

    /// <summary>
    /// Quality assurance settings
    /// </summary>
    [Serializable]
    public class QualitySettings
    {
        public bool checkTextOverflow;
        public bool checkMissingTranslations;
        public bool checkConsistency;
        public bool checkFormatting;
        public bool checkPlaceholders;
        public int maxTextLength = 255;
        public List<string> forbiddenWords;
        public List<string> requiredTerms;
    }

    /// <summary>
    /// Project information
    /// </summary>
    [Serializable]
    public class ProjectInfo
    {
        public string projectName;
        public string unityVersion;
        public string targetPlatform;
        public string projectPath;
        public string traduxVersion;
        public DateTime lastScan;
        public int totalStrings;
        public int translatedStrings;
        public int reviewedStrings;
    }

    /// <summary>
    /// Translatable asset information
    /// </summary>
    [Serializable]
    public class TranslatableAsset
    {
        public string path;
        public string fullPath;
        public string fileName;
        public string extension;
        public long size;
        public DateTime lastModified;
        public bool isUnityAsset;
        public string assetType;
        public List<TranslatableString> strings;
        public int stringCount;
        public int translatedCount;
        public int reviewedCount;
        public float translationProgress;
        public float reviewProgress;
    }

    /// <summary>
    /// Individual translatable string
    /// </summary>
    [Serializable]
    public class TranslatableString
    {
        public string id;
        public string key;
        public string sourceText;
        public string translatedText;
        public string context;
        public string assetPath;
        public string componentType;
        public bool isTranslated;
        public bool isReviewed;
        public bool isAutoTranslated;
        public DateTime createdDate;
        public DateTime modifiedDate;
        public string translatorId;
        public string reviewerId;
        public List<string> tags;
        public Dictionary<string, string> translations; // language -> translation
        public TranslationQuality quality;
    }

    /// <summary>
    /// Translation quality metrics
    /// </summary>
    [Serializable]
    public class TranslationQuality
    {
        public float score; // 0.0 to 1.0
        public bool hasIssues;
        public List<QualityIssue> issues;
        public string feedback;
        public DateTime lastChecked;
    }

    /// <summary>
    /// Quality issue information
    /// </summary>
    [Serializable]
    public class QualityIssue
    {
        public string type; // overflow, missing, consistency, formatting, etc.
        public string severity; // error, warning, info
        public string message;
        public string suggestion;
        public bool isResolved;
    }

    /// <summary>
    /// Extraction result
    /// </summary>
    [Serializable]
    public class ExtractionResult
    {
        public bool success;
        public string errorMessage;
        public int totalAssets;
        public int totalStrings;
        public List<TranslatableAsset> assets;
        public List<string> warnings;
        public List<string> errors;
        public TimeSpan duration;
    }

    /// <summary>
    /// Translation batch
    /// </summary>
    [Serializable]
    public class TranslationBatch
    {
        public string id;
        public string sourceLanguage;
        public string targetLanguage;
        public List<string> stringIds;
        public DateTime createdDate;
        public DateTime completedDate;
        public TranslationStatus status;
        public int totalCount;
        public int completedCount;
        public int errorCount;
        public List<TranslationError> errors;
    }

    /// <summary>
    /// Translation status enumeration
    /// </summary>
    public enum TranslationStatus
    {
        Pending,
        InProgress,
        Completed,
        Failed,
        Cancelled
    }

    /// <summary>
    /// Translation error information
    /// </summary>
    [Serializable]
    public class TranslationError
    {
        public string stringId;
        public string errorMessage;
        public string errorCode;
        public DateTime timestamp;
    }

    /// <summary>
    /// Translation memory entry
    /// </summary>
    [Serializable]
    public class TranslationMemoryEntry
    {
        public string sourceText;
        public string targetLanguage;
        public string translatedText;
        public string context;
        public int usageCount;
        public DateTime lastUsed;
        public float confidence;
        public string source; // human, auto, memory, etc.
        public List<string> tags;
    }

    /// <summary>
    /// Glossary term
    /// </summary>
    [Serializable]
    public class GlossaryTerm
    {
        public string sourceTerm;
        public string targetLanguage;
        public string translatedTerm;
        public string definition;
        public string context;
        public string partOfSpeech;
        public List<string> synonyms;
        public List<string> examples;
        public bool isApproved;
        public string approverId;
        public DateTime approvedDate;
    }

    /// <summary>
    /// Translation project
    /// </summary>
    [Serializable]
    public class TranslationProject
    {
        public string id;
        public string name;
        public string description;
        public string sourceLanguage;
        public List<string> targetLanguages;
        public DateTime createdDate;
        public DateTime modifiedDate;
        public string status;
        public ProjectInfo projectInfo;
        public List<TranslatableAsset> assets;
        public Dictionary<string, TranslationMemoryEntry> translationMemory;
        public Dictionary<string, GlossaryTerm> glossary;
        public ProjectStatistics statistics;
    }

    /// <summary>
    /// Project statistics
    /// </summary>
    [Serializable]
    public class ProjectStatistics
    {
        public int totalStrings;
        public int translatedStrings;
        public int reviewedStrings;
        public int approvedStrings;
        public float translationProgress;
        public float reviewProgress;
        public float approvalProgress;
        public TimeSpan totalTranslationTime;
        public float averageTranslationSpeed; // strings per hour
        public Dictionary<string, int> stringsByLanguage;
        public Dictionary<string, int> stringsByType;
        public List<string> topTranslators;
        public List<string> topReviewers;
    }
}

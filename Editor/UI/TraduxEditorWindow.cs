using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using TRADUX.Editor.Core;
using TRADUX.Editor.Models;

namespace TRADUX.Editor.UI
{
    /// <summary>
    /// Main TRADUX Editor Window
    /// </summary>
    public class TraduxEditorWindow : EditorWindow
    {
        private Vector2 scrollPosition;
        private int selectedTab = 0;
        private string[] tabNames = { "Project", "Extraction", "Translation", "Quality", "Settings" };
        
        // Project tab
        private List<TranslatableAsset> projectAssets;
        private ProjectInfo projectInfo;
        private bool isScanning = false;
        private string scanProgress = "";
        
        // Extraction tab
        private List<string> selectedAssetPaths;
        private bool isExtracting = false;
        private string extractionProgress = "";
        
        // Translation tab
        private List<TranslatableString> translationStrings;
        private int selectedStringIndex = -1;
        private string targetLanguage = "pt";
        private string[] availableLanguages = { "pt", "es", "fr", "de", "it", "ja", "ko", "zh", "ru" };
        private Vector2 translationScrollPosition;
        
        // Quality tab
        private List<QualityIssue> qualityIssues;
        private bool isRunningQualityCheck = false;
        
        // Settings
        private TraduxSettings settings;
        private Vector2 settingsScrollPosition;

        [MenuItem("TRADUX/Open Translation Editor")]
        public static void ShowWindow()
        {
            var window = GetWindow<TraduxEditorWindow>("TRADUX 2.0");
            window.minSize = new Vector2(800, 600);
            window.Show();
        }

        private void OnEnable()
        {
            TraduxCore.Initialize();
            settings = TraduxCore.Settings;
            LoadProjectData();
        }

        private void OnGUI()
        {
            DrawHeader();
            DrawTabs();
            
            EditorGUILayout.Space(10);
            
            switch (selectedTab)
            {
                case 0:
                    DrawProjectTab();
                    break;
                case 1:
                    DrawExtractionTab();
                    break;
                case 2:
                    DrawTranslationTab();
                    break;
                case 3:
                    DrawQualityTab();
                    break;
                case 4:
                    DrawSettingsTab();
                    break;
            }
        }

        private void DrawHeader()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            
            GUILayout.Label("TRADUX 2.0 - Unity Translation Tool", EditorStyles.boldLabel);
            
            GUILayout.FlexibleSpace();
            
            if (GUILayout.Button("Refresh", EditorStyles.toolbarButton))
            {
                LoadProjectData();
            }
            
            if (GUILayout.Button("Help", EditorStyles.toolbarButton))
            {
                Application.OpenURL("https://github.com/TRFigueira/TRADUX-2.0");
            }
            
            EditorGUILayout.EndHorizontal();
        }

        private void DrawTabs()
        {
            selectedTab = GUILayout.Toolbar(selectedTab, tabNames);
        }

        private void DrawProjectTab()
        {
            EditorGUILayout.BeginVertical();
            
            // Project info
            if (projectInfo != null)
            {
                EditorGUILayout.BeginVertical(EditorStyles.helpBox);
                GUILayout.Label("Project Information", EditorStyles.boldLabel);
                GUILayout.Label($"Name: {projectInfo.projectName}");
                GUILayout.Label($"Unity Version: {projectInfo.unityVersion}");
                GUILayout.Label($"Target Platform: {projectInfo.targetPlatform}");
                GUILayout.Label($"TRADUX Version: {projectInfo.traduxVersion}");
                GUILayout.Label($"Last Scan: {projectInfo.lastScan:yyyy-MM-dd HH:mm}");
                EditorGUILayout.EndVertical();
            }
            
            EditorGUILayout.Space(10);
            
            // Scan button
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button(isScanning ? "Scanning..." : "Scan Project for Translatable Assets", GUILayout.Height(30)))
            {
                if (!isScanning)
                {
                    ScanProject();
                }
            }
            
            if (GUILayout.Button("Open Project Folder", GUILayout.Width(150), GUILayout.Height(30)))
            {
                EditorUtility.RevealInFinder(Application.dataPath);
            }
            EditorGUILayout.EndHorizontal();
            
            if (isScanning)
            {
                EditorGUILayout.HelpBox(scanProgress, MessageType.Info);
            }
            
            EditorGUILayout.Space(10);
            
            // Assets list
            if (projectAssets != null && projectAssets.Count > 0)
            {
                GUILayout.Label($"Found {projectAssets.Count} Translatable Assets", EditorStyles.boldLabel);
                
                scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
                
                foreach (var asset in projectAssets)
                {
                    DrawAssetItem(asset);
                }
                
                EditorGUILayout.EndScrollView();
            }
            else if (!isScanning)
            {
                EditorGUILayout.HelpBox("No translatable assets found. Click 'Scan Project' to search for translatable files.", MessageType.Info);
            }
            
            EditorGUILayout.EndVertical();
        }

        private void DrawAssetItem(TranslatableAsset asset)
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            
            EditorGUILayout.BeginHorizontal();
            
            // Asset icon and info
            string icon = asset.isUnityAsset ? "Unity" : GetFileIcon(asset.extension);
            GUILayout.Label(icon, GUILayout.Width(50));
            
            EditorGUILayout.BeginVertical();
            GUILayout.Label(asset.fileName, EditorStyles.boldLabel);
            GUILayout.Label($"{asset.path} ({FormatFileSize(asset.size)})", EditorStyles.miniLabel);
            
            if (asset.isUnityAsset)
            {
                GUILayout.Label($"Type: {asset.assetType}", EditorStyles.miniLabel);
            }
            
            EditorGUILayout.EndVertical();
            
            GUILayout.FlexibleSpace();
            
            // Progress bar
            if (asset.stringCount > 0)
            {
                float progress = (float)asset.translatedCount / asset.stringCount;
                EditorGUI.ProgressBar(EditorGUILayout.GetControlRect(), progress, $"{asset.translatedCount}/{asset.stringCount}");
            }
            
            EditorGUILayout.EndHorizontal();
            
            // Action buttons
            EditorGUILayout.BeginHorizontal();
            
            if (GUILayout.Button("Select", GUILayout.Width(60)))
            {
                if (selectedAssetPaths == null)
                    selectedAssetPaths = new List<string>();
                
                string fullPath = Path.Combine(Application.dataPath, "..", asset.path);
                if (!selectedAssetPaths.Contains(fullPath))
                    selectedAssetPaths.Add(fullPath);
            }
            
            if (GUILayout.Button("View Strings", GUILayout.Width(80)))
            {
                ViewAssetStrings(asset);
            }
            
            EditorGUILayout.EndHorizontal();
            
            EditorGUILayout.EndVertical();
        }

        private void DrawExtractionTab()
        {
            EditorGUILayout.BeginVertical();
            
            GUILayout.Label("Asset Extraction", EditorStyles.boldLabel);
            
            // AssetStudio status
            bool assetStudioAvailable = TraduxAssetStudioIntegration.IsAvailable();
            
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            GUILayout.Label("AssetStudio CLI Status", EditorStyles.boldLabel);
            
            if (assetStudioAvailable)
            {
                GUILayout.Label("Status: Available", new GUIStyle(GUI.skin.label) { normal = { textColor = Color.green } });
            }
            else
            {
                GUILayout.Label("Status: Not Available", new GUIStyle(GUI.skin.label) { normal = { textColor = Color.red } });
                
                if (GUILayout.Button("Install AssetStudio CLI"))
                {
                    InstallAssetStudio();
                }
            }
            EditorGUILayout.EndVertical();
            
            EditorGUILayout.Space(10);
            
            // Selected assets
            if (selectedAssetPaths != null && selectedAssetPaths.Count > 0)
            {
                GUILayout.Label($"Selected {selectedAssetPaths.Count} Assets for Extraction", EditorStyles.boldLabel);
                
                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Clear Selection"))
                {
                    selectedAssetPaths.Clear();
                }
                
                if (GUILayout.Button("Extract Selected") && !isExtracting)
                {
                    ExtractSelectedAssets();
                }
                EditorGUILayout.EndHorizontal();
                
                // Show selected assets
                scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
                
                foreach (string path in selectedAssetPaths)
                {
                    EditorGUILayout.BeginHorizontal();
                    GUILayout.Label(Path.GetFileName(path));
                    GUILayout.FlexibleSpace();
                    if (GUILayout.Button("Remove", GUILayout.Width(60)))
                    {
                        selectedAssetPaths.Remove(path);
                        break;
                    }
                    EditorGUILayout.EndHorizontal();
                }
                
                EditorGUILayout.EndScrollView();
            }
            else
            {
                EditorGUILayout.HelpBox("No assets selected for extraction. Go to Project tab to select assets.", MessageType.Info);
            }
            
            if (isExtracting)
            {
                EditorGUILayout.HelpBox(extractionProgress, MessageType.Info);
            }
            
            EditorGUILayout.EndVertical();
        }

        private void DrawTranslationTab()
        {
            EditorGUILayout.BeginVertical();
            
            GUILayout.Label("Translation Editor", EditorStyles.boldLabel);
            
            // Language selection
            EditorGUILayout.BeginHorizontal();
            GUILayout.Label("Target Language:", GUILayout.Width(100));
            targetLanguage = EditorGUILayout.TextField(targetLanguage);
            
            if (GUILayout.Button("Load Translations"))
            {
                LoadTranslations();
            }
            EditorGUILayout.EndHorizontal();
            
            EditorGUILayout.Space(10);
            
            // Strings list
            if (translationStrings != null && translationStrings.Count > 0)
            {
                EditorGUILayout.BeginHorizontal();
                GUILayout.Label($"Found {translationStrings.Count} Strings", EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                GUILayout.Label($"Selected: {selectedStringIndex + 1}/{translationStrings.Count}");
                EditorGUILayout.EndHorizontal();
                
                EditorGUILayout.Space(5);
                
                // Split view: list and editor
                EditorGUILayout.BeginHorizontal();
                
                // Strings list (left side)
                EditorGUILayout.BeginVertical(GUILayout.Width(300));
                GUILayout.Label("Strings", EditorStyles.boldLabel);
                
                translationScrollPosition = EditorGUILayout.BeginScrollView(translationScrollPosition);
                
                for (int i = 0; i < translationStrings.Count; i++)
                {
                    var str = translationStrings[i];
                    
                    GUIStyle style = i == selectedStringIndex ? EditorStyles.selectedLabel : EditorStyles.label;
                    
                    if (GUILayout.Button($"{str.key} - {str.sourceText.Substring(0, Mathf.Min(50, str.sourceText.Length))}...", style))
                    {
                        selectedStringIndex = i;
                    }
                }
                
                EditorGUILayout.EndScrollView();
                EditorGUILayout.EndVertical();
                
                // Translation editor (right side)
                if (selectedStringIndex >= 0 && selectedStringIndex < translationStrings.Count)
                {
                    DrawTranslationEditor(translationStrings[selectedStringIndex]);
                }
                
                EditorGUILayout.EndHorizontal();
            }
            else
            {
                EditorGUILayout.HelpBox("No strings loaded. Extract assets or load translations first.", MessageType.Info);
            }
            
            EditorGUILayout.EndVertical();
        }

        private void DrawTranslationEditor(TranslatableString transString)
        {
            EditorGUILayout.BeginVertical(GUILayout.Width(450));
            
            GUILayout.Label("Translation Editor", EditorStyles.boldLabel);
            
            EditorGUILayout.Space(10);
            
            // Source text
            GUILayout.Label("Source Text:", EditorStyles.boldLabel);
            EditorGUILayout.TextArea(transString.sourceText, GUILayout.Height(80));
            
            EditorGUILayout.Space(10);
            
            // Translation
            GUILayout.Label("Translation:", EditorStyles.boldLabel);
            
            string translation = "";
            if (transString.translations.ContainsKey(targetLanguage))
            {
                translation = transString.translations[targetLanguage];
            }
            
            string newTranslation = EditorGUILayout.TextArea(translation, GUILayout.Height(80));
            
            if (newTranslation != translation)
            {
                if (transString.translations.ContainsKey(targetLanguage))
                {
                    transString.translations[targetLanguage] = newTranslation;
                }
                else
                {
                    transString.translations.Add(targetLanguage, newTranslation);
                }
                
                transString.isTranslated = !string.IsNullOrEmpty(newTranslation);
                transString.modifiedDate = System.DateTime.Now;
            }
            
            EditorGUILayout.Space(10);
            
            // Context
            GUILayout.Label("Context:", EditorStyles.boldLabel);
            EditorGUILayout.TextArea(transString.context, GUILayout.Height(60));
            
            EditorGUILayout.Space(10);
            
            // Actions
            EditorGUILayout.BeginHorizontal();
            
            if (GUILayout.Button("Auto Translate"))
            {
                AutoTranslate(transString);
            }
            
            if (GUILayout.Button("Save"))
            {
                SaveTranslation(transString);
            }
            
            if (GUILayout.Button("Next"))
            {
                if (selectedStringIndex < translationStrings.Count - 1)
                    selectedStringIndex++;
            }
            EditorGUILayout.EndHorizontal();
            
            EditorGUILayout.EndVertical();
        }

        private void DrawQualityTab()
        {
            EditorGUILayout.BeginVertical();
            
            GUILayout.Label("Quality Assurance", EditorStyles.boldLabel);
            
            // Quality check button
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button(isRunningQualityCheck ? "Checking..." : "Run Quality Check", GUILayout.Height(30)))
            {
                if (!isRunningQualityCheck)
                {
                    RunQualityCheck();
                }
            }
            
            if (GUILayout.Button("Clear Issues", GUILayout.Width(100), GUILayout.Height(30)))
            {
                qualityIssues?.Clear();
            }
            EditorGUILayout.EndHorizontal();
            
            EditorGUILayout.Space(10);
            
            // Issues list
            if (qualityIssues != null && qualityIssues.Count > 0)
            {
                GUILayout.Label($"Found {qualityIssues.Count} Issues", EditorStyles.boldLabel);
                
                scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
                
                foreach (var issue in qualityIssues)
                {
                    DrawQualityIssue(issue);
                }
                
                EditorGUILayout.EndScrollView();
            }
            else if (!isRunningQualityCheck)
            {
                EditorGUILayout.HelpBox("No quality issues found. Run quality check to analyze translations.", MessageType.Info);
            }
            
            EditorGUILayout.EndVertical();
        }

        private void DrawQualityIssue(QualityIssue issue)
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            
            EditorGUILayout.BeginHorizontal();
            
            // Severity icon
            Color color = issue.severity == "error" ? Color.red : issue.severity == "warning" ? Color.yellow : Color.gray;
            GUILayout.Label("!", new GUIStyle(GUI.skin.label) { normal = { textColor = color }, fontStyle = FontStyle.Bold }, GUILayout.Width(20));
            
            EditorGUILayout.BeginVertical();
            GUILayout.Label(issue.type, EditorStyles.boldLabel);
            GUILayout.Label(issue.message, EditorStyles.wordWrappedLabel);
            EditorGUILayout.EndVertical();
            
            GUILayout.FlexibleSpace();
            
            if (GUILayout.Button("Fix", GUILayout.Width(50)))
            {
                FixQualityIssue(issue);
            }
            
            EditorGUILayout.EndHorizontal();
            
            if (!string.IsNullOrEmpty(issue.suggestion))
            {
                GUILayout.Label($"Suggestion: {issue.suggestion}", EditorStyles.miniLabel);
            }
            
            EditorGUILayout.EndVertical();
        }

        private void DrawSettingsTab()
        {
            EditorGUILayout.BeginVertical();
            
            GUILayout.Label("TRADUX Settings", EditorStyles.boldLabel);
            
            if (settings == null)
            {
                EditorGUILayout.HelpBox("Settings not loaded. Please restart TRADUX.", MessageType.Error);
                return;
            }
            
            settingsScrollPosition = EditorGUILayout.BeginScrollView(settingsScrollPosition);
            
            // Translation API settings
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            GUILayout.Label("Translation API", EditorStyles.boldLabel);
            
            settings.translationAPISettings.provider = EditorGUILayout.TextField("Provider", settings.translationAPISettings.provider);
            settings.translationAPISettings.apiKey = EditorGUILayout.PasswordField("API Key", settings.translationAPISettings.apiKey);
            settings.translationAPISettings.autoTranslate = EditorGUILayout.Toggle("Auto Translate", settings.translationAPISettings.autoTranslate);
            
            EditorGUILayout.EndVertical();
            
            EditorGUILayout.Space(10);
            
            // Extraction settings
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            GUILayout.Label("Extraction Settings", EditorStyles.boldLabel);
            
            settings.extractionSettings.includeScriptableObject = EditorGUILayout.Toggle("Include ScriptableObjects", settings.extractionSettings.includeScriptableObject);
            settings.extractionSettings.includePrefabs = EditorGUILayout.Toggle("Include Prefabs", settings.extractionSettings.includePrefabs);
            settings.extractionSettings.includeScenes = EditorGUILayout.Toggle("Include Scenes", settings.extractionSettings.includeScenes);
            settings.extractionSettings.includeScripts = EditorGUILayout.Toggle("Include Scripts", settings.extractionSettings.includeScripts);
            
            EditorGUILayout.EndVertical();
            
            EditorGUILayout.Space(10);
            
            // Quality settings
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            GUILayout.Label("Quality Settings", EditorStyles.boldLabel);
            
            settings.qualitySettings.checkTextOverflow = EditorGUILayout.Toggle("Check Text Overflow", settings.qualitySettings.checkTextOverflow);
            settings.qualitySettings.checkMissingTranslations = EditorGUILayout.Toggle("Check Missing Translations", settings.qualitySettings.checkMissingTranslations);
            settings.qualitySettings.checkConsistency = EditorGUILayout.Toggle("Check Consistency", settings.qualitySettings.checkConsistency);
            settings.qualitySettings.checkFormatting = EditorGUILayout.Toggle("Check Formatting", settings.qualitySettings.checkFormatting);
            
            EditorGUILayout.EndVertical();
            
            EditorGUILayout.Space(10);
            
            // Save button
            if (GUILayout.Button("Save Settings"))
            {
                TraduxCore.SaveSettings();
                EditorUtility.DisplayDialog("TRADUX", "Settings saved successfully!", "OK");
            }
            
            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();
        }

        private async void ScanProject()
        {
            isScanning = true;
            scanProgress = "Scanning project for translatable assets...";
            
            try
            {
                projectAssets = await Task.Run(() => TraduxCore.ScanProject());
                projectInfo = TraduxCore.GetProjectInfo();
                projectInfo.lastScan = System.DateTime.Now;
                
                scanProgress = $"Scan completed! Found {projectAssets.Count} translatable assets.";
            }
            catch (System.Exception e)
            {
                scanProgress = $"Scan failed: {e.Message}";
                Debug.LogError($"[TRADUX] Scan error: {e.Message}");
            }
            finally
            {
                isScanning = false;
                Repaint();
            }
        }

        private void LoadProjectData()
        {
            projectInfo = TraduxCore.GetProjectInfo();
            // Load other data as needed
        }

        private string GetFileIcon(string extension)
        {
            switch (extension.ToLower())
            {
                case ".json": return "JSON";
                case ".csv": return "CSV";
                case ".xml": return "XML";
                case ".txt": return "TXT";
                case ".yaml":
                case ".yml": return "YAML";
                default: return "FILE";
            }
        }

        private string FormatFileSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }

        private void ViewAssetStrings(TranslatableAsset asset)
        {
            // Implementation for viewing asset strings
            Debug.Log($"View strings for {asset.fileName}");
        }

        private async void InstallAssetStudio()
        {
            bool success = await TraduxAssetStudioIntegration.InstallAssetStudioCLI();
            if (success)
            {
                EditorUtility.DisplayDialog("TRADUX", "AssetStudio CLI installation started. Please complete the extraction manually.", "OK");
            }
            else
            {
                EditorUtility.DisplayDialog("TRADUX", "Failed to install AssetStudio CLI. Please install manually.", "OK");
            }
        }

        private async void ExtractSelectedAssets()
        {
            if (selectedAssetPaths == null || selectedAssetPaths.Count == 0) return;

            isExtracting = true;
            extractionProgress = "Extracting texts from selected assets...";

            try
            {
                var result = await TraduxAssetStudioIntegration.ExtractFromAssets(selectedAssetPaths);
                
                if (result.success)
                {
                    extractionProgress = $"Extraction completed! Extracted {result.totalStrings} strings from {result.totalAssets} assets.";
                    
                    // Load extracted strings for translation
                    LoadExtractedStrings(result.assets);
                }
                else
                {
                    extractionProgress = $"Extraction failed: {result.errorMessage}";
                }
            }
            catch (System.Exception e)
            {
                extractionProgress = $"Extraction error: {e.Message}";
                Debug.LogError($"[TRADUX] Extraction error: {e.Message}");
            }
            finally
            {
                isExtracting = false;
                Repaint();
            }
        }

        private void LoadExtractedStrings(List<TranslatableAsset> assets)
        {
            translationStrings = new List<TranslatableString>();
            
            foreach (var asset in assets)
            {
                if (asset.strings != null)
                {
                    translationStrings.AddRange(asset.strings);
                }
            }
            
            selectedStringIndex = translationStrings.Count > 0 ? 0 : -1;
        }

        private void LoadTranslations()
        {
            // Implementation for loading translations
            Debug.Log($"Loading translations for {targetLanguage}");
        }

        private void AutoTranslate(TranslatableString transString)
        {
            // Implementation for auto translation
            Debug.Log($"Auto translating: {transString.sourceText}");
        }

        private void SaveTranslation(TranslatableString transString)
        {
            // Implementation for saving translation
            Debug.Log($"Saving translation for: {transString.key}");
        }

        private async void RunQualityCheck()
        {
            isRunningQualityCheck = true;
            
            try
            {
                // Implementation for quality check
                await Task.Delay(2000); // Simulate quality check
                
                qualityIssues = new List<QualityIssue>();
                
                if (translationStrings != null)
                {
                    foreach (var str in translationStrings)
                    {
                        if (!str.isTranslated)
                        {
                            qualityIssues.Add(new QualityIssue
                            {
                                type = "Missing Translation",
                                severity = "warning",
                                message = $"Translation missing for: {str.key}",
                                suggestion = "Add translation or mark as not translatable"
                            });
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Quality check error: {e.Message}");
            }
            finally
            {
                isRunningQualityCheck = false;
                Repaint();
            }
        }

        private void FixQualityIssue(QualityIssue issue)
        {
            // Implementation for fixing quality issues
            Debug.Log($"Fixing issue: {issue.type}");
        }
    }
}

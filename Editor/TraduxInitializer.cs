using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;
using TRADUX.Editor.Core;
using TRADUX.Editor.UI;

namespace TRADUX.Editor
{
    /// <summary>
    /// Main entry point for TRADUX Unity Package
    /// </summary>
    public static class TraduxInitializer
    {
        [InitializeOnLoadMethod]
        private static void Initialize()
        {
            Debug.Log("[TRADUX] Initializing TRADUX Translation Tool v2.0.0");
            
            // Initialize core services
            TraduxCore.Initialize();
            
            // Register menu items
            RegisterMenuItems();
            
            // Check for Unity project compatibility
            CheckUnityCompatibility();
        }

        private static void RegisterMenuItems()
        {
            // Main TRADUX menu
            Menu.AddItem(new GUIContent("TRADUX/Open Translation Editor"), false, OpenTranslationEditor);
            Menu.AddItem(new GUIContent("TRADUX/Extract Game Texts"), false, ExtractGameTexts);
            Menu.AddItem(new GUIContent("TRADUX/Import Translations"), false, ImportTranslations);
            Menu.AddItem(new GUIContent("TRADUX/Export Translations"), false, ExportTranslations);
            Menu.AddItem(new GUIContent("TRADUX/Settings"), false, OpenSettings);
            
            // Add separator
            Menu.AddItem(new GUIContent("TRADUX/"), false, null);
            
            // Context menu items
            Menu.AddItem(new GUIContent("Assets/TRADUX/Extract Texts"), false, ExtractFromSelectedAssets);
        }

        private static void OpenTranslationEditor()
        {
            TraduxEditorWindow.ShowWindow();
        }

        private static void ExtractGameTexts()
        {
            TraduxExtractor.ShowExtractionWindow();
        }

        private static void ImportTranslations()
        {
            TraduxImporter.ShowImportWindow();
        }

        private static void ExportTranslations()
        {
            TraduxExporter.ShowExportWindow();
        }

        private static void OpenSettings()
        {
            TraduxSettingsWindow.ShowWindow();
        }

        private static void ExtractFromSelectedAssets()
        {
            var selectedAssets = Selection.GetFiltered<UnityEngine.Object>(SelectionMode.Assets);
            if (selectedAssets.Length > 0)
            {
                TraduxExtractor.ExtractFromAssets(selectedAssets);
            }
            else
            {
                EditorUtility.DisplayDialog("TRADUX", "Please select one or more assets to extract texts from.", "OK");
            }
        }

        private static void CheckUnityCompatibility()
        {
            string unityVersion = Application.unityVersion;
            string requiredVersion = "2021.3.0";
            
            if (VersionComparison(unityVersion, requiredVersion) < 0)
            {
                EditorUtility.DisplayDialog(
                    "TRADUX - Unity Version Warning",
                    $"TRADUX requires Unity {requiredVersion} or higher. Current version: {unityVersion}\n\nSome features may not work correctly.",
                    "Continue Anyway"
                );
            }
        }

        private static int VersionComparison(string version1, string version2)
        {
            string[] v1Parts = version1.Split('.');
            string[] v2Parts = version2.Split('.');
            
            for (int i = 0; i < Mathf.Min(v1Parts.Length, v2Parts.Length); i++)
            {
                if (int.TryParse(v1Parts[i], out int v1Num) && int.TryParse(v2Parts[i], out int v2Num))
                {
                    int comparison = v1Num.CompareTo(v2Num);
                    if (comparison != 0) return comparison;
                }
            }
            
            return v1Parts.Length.CompareTo(v2Parts.Length);
        }
    }
}

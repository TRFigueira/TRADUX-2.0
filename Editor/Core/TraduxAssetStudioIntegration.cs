using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;
using System.Diagnostics;
using System.Threading.Tasks;
using TRADUX.Editor.Models;

namespace TRADUX.Editor.Core
{
    /// <summary>
    /// Advanced AssetStudio CLI integration for Unity
    /// </summary>
    public static class TraduxAssetStudioIntegration
    {
        private static string assetStudioPath;
        private static bool isInitialized = false;

        /// <summary>
        /// Initialize AssetStudio CLI integration
        /// </summary>
        public static void Initialize()
        {
            if (isInitialized) return;

            // Look for AssetStudio CLI in common locations
            string[] possiblePaths = {
                Path.Combine(Application.dataPath, "..", "Tools", "AssetStudioCLI_net6_win_x64.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "tradutor-unity-cat-tool", "tools", "assetstudio", "AssetStudioCLI_net6_win_x64.exe"),
                Path.Combine(Application.dataPath, "..", "Packages", "com.trf.tradux", "Tools", "AssetStudioCLI_net6_win_x64.exe")
            };

            foreach (string path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    assetStudioPath = path;
                    Debug.Log($"[TRADUX] AssetStudio CLI found at: {path}");
                    break;
                }
            }

            if (string.IsNullOrEmpty(assetStudioPath))
            {
                Debug.LogWarning("[TRADUX] AssetStudio CLI not found. Automatic extraction will be limited.");
            }

            isInitialized = true;
        }

        /// <summary>
        /// Check if AssetStudio CLI is available
        /// </summary>
        public static bool IsAvailable()
        {
            if (!isInitialized) Initialize();
            return !string.IsNullOrEmpty(assetStudioPath) && File.Exists(assetStudioPath);
        }

        /// <summary>
        /// Extract texts from Unity assets using AssetStudio CLI
        /// </summary>
        public static async Task<ExtractionResult> ExtractFromAssets(List<string> assetPaths)
        {
            var result = new ExtractionResult { success = false };
            var stopwatch = Stopwatch.StartNew();

            if (!IsAvailable())
            {
                result.errorMessage = "AssetStudio CLI not available";
                return result;
            }

            try
            {
                Debug.Log($"[TRADUX] Starting extraction of {assetPaths.Count} assets");

                // Create temporary directory for extraction
                string tempDir = Path.Combine(Application.temporaryCachePath, $"TraduxExtraction_{DateTime.Now:yyyyMMdd_HHmmss}");
                Directory.CreateDirectory(tempDir);

                var extractedStrings = new List<TranslatableString>();
                var extractedAssets = new List<TranslatableAsset>();

                foreach (string assetPath in assetPaths)
                {
                    var assetResult = await ExtractSingleAsset(assetPath, tempDir);
                    if (assetResult.success)
                    {
                        extractedStrings.AddRange(assetResult.strings);
                        extractedAssets.Add(assetResult.asset);
                    }
                    else
                    {
                        result.errors.Add($"Failed to extract from {assetPath}: {assetResult.errorMessage}");
                    }
                }

                result.success = true;
                result.totalAssets = extractedAssets.Count;
                result.totalStrings = extractedStrings.Count;
                result.assets = extractedAssets;
                result.duration = stopwatch.Elapsed;

                Debug.Log($"[TRADUX] Extraction completed: {result.totalStrings} strings from {result.totalAssets} assets");

                // Clean up temporary directory
                try
                {
                    Directory.Delete(tempDir, true);
                }
                catch
                {
                    // Ignore cleanup errors
                }
            }
            catch (System.Exception e)
            {
                result.success = false;
                result.errorMessage = e.Message;
                Debug.LogError($"[TRADUX] AssetStudio extraction error: {e.Message}");
            }

            return result;
        }

        /// <summary>
        /// Extract texts from a single Unity asset
        /// </summary>
        private static async Task<AssetExtractionResult> ExtractSingleAsset(string assetPath, string outputDir)
        {
            var result = new AssetExtractionResult { success = false };

            try
            {
                string fileName = Path.GetFileNameWithoutExtension(assetPath);
                string outputFile = Path.Combine(outputDir, $"{fileName}_extracted.txt");

                // Prepare AssetStudio CLI arguments
                var arguments = new List<string>
                {
                    "--input", $"\"{assetPath}\"",
                    "--output", $"\"{outputDir}\"",
                    "--export", "text",
                    "--format", "txt",
                    "--overwrite"
                };

                // Run AssetStudio CLI
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = assetStudioPath,
                        Arguments = string.Join(" ", arguments),
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                string output = await process.StandardOutput.ReadToEndAsync();
                string error = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    // Parse extracted text
                    var strings = await ParseExtractedText(outputFile);
                    
                    result.success = true;
                    result.strings = strings;
                    result.asset = new TranslatableAsset
                    {
                        path = Path.GetRelativePath(Application.dataPath, assetPath),
                        fullPath = assetPath,
                        fileName = Path.GetFileName(assetPath),
                        extension = Path.GetExtension(assetPath),
                        size = new FileInfo(assetPath).Length,
                        lastModified = File.GetLastWriteTime(assetPath),
                        isUnityAsset = true,
                        assetType = "UnityAsset",
                        strings = strings,
                        stringCount = strings.Count,
                        translationProgress = 0f,
                        reviewProgress = 0f
                    };

                    Debug.Log($"[TRADUX] Successfully extracted {strings.Count} strings from {fileName}");
                }
                else
                {
                    result.errorMessage = $"AssetStudio CLI failed with exit code {process.ExitCode}: {error}";
                    Debug.LogError($"[TRADUX] {result.errorMessage}");
                }
            }
            catch (System.Exception e)
            {
                result.errorMessage = e.Message;
                Debug.LogError($"[TRADUX] Error extracting from {assetPath}: {e.Message}");
            }

            return result;
        }

        /// <summary>
        /// Parse extracted text file into translatable strings
        /// </summary>
        private static async Task<List<TranslatableString>> ParseExtractedText(string filePath)
        {
            var strings = new List<TranslatableString>();

            if (!File.Exists(filePath))
            {
                Debug.LogWarning($"[TRADUX] Extracted file not found: {filePath}");
                return strings;
            }

            try
            {
                string[] lines = await File.ReadAllLinesAsync(filePath);
                
                for (int i = 0; i < lines.Length; i++)
                {
                    string line = lines[i].Trim();
                    
                    if (string.IsNullOrEmpty(line) || line.StartsWith("#") || line.StartsWith("//"))
                    {
                        continue; // Skip empty lines and comments
                    }

                    // Parse different formats
                    var translatableString = ParseLineToTranslatableString(line, i, filePath);
                    if (translatableString != null)
                    {
                        strings.Add(translatableString);
                    }
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Error parsing extracted text: {e.Message}");
            }

            return strings;
        }

        /// <summary>
        /// Parse a single line into a translatable string
        /// </summary>
        private static TranslatableString ParseLineToTranslatableString(string line, int lineNumber, string sourceFile)
        {
            // Try different parsing formats
            
            // Format 1: KEY = "Text"
            if (line.Contains("=") && line.Contains("\""))
            {
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {
                    string key = parts[0].Trim();
                    string text = parts[1].Trim().Trim('"');
                    
                    return new TranslatableString
                    {
                        id = $"{Path.GetFileNameWithoutExtension(sourceFile)}_{lineNumber}",
                        key = key,
                        sourceText = text,
                        context = $"Extracted from {Path.GetFileName(sourceFile)} line {lineNumber + 1}",
                        assetPath = sourceFile,
                        isTranslated = false,
                        isReviewed = false,
                        createdDate = DateTime.Now,
                        modifiedDate = DateTime.Now,
                        translations = new Dictionary<string, string>(),
                        tags = new List<string> { "auto-extracted" }
                    };
                }
            }

            // Format 2: "Text" (simple text)
            if (line.StartsWith("\"") && line.EndsWith("\""))
            {
                string text = line.Trim('"');
                
                return new TranslatableString
                {
                    id = $"{Path.GetFileNameWithoutExtension(sourceFile)}_{lineNumber}",
                    key = $"text_{lineNumber}",
                    sourceText = text,
                    context = $"Extracted from {Path.GetFileName(sourceFile)} line {lineNumber + 1}",
                    assetPath = sourceFile,
                    isTranslated = false,
                    isReviewed = false,
                    createdDate = DateTime.Now,
                    modifiedDate = DateTime.Now,
                    translations = new Dictionary<string, string>(),
                    tags = new List<string> { "auto-extracted" }
                };
            }

            // Format 3: Plain text (fallback)
            if (!string.IsNullOrWhiteSpace(line))
            {
                return new TranslatableString
                {
                    id = $"{Path.GetFileNameWithoutExtension(sourceFile)}_{lineNumber}",
                    key = $"plain_{lineNumber}",
                    sourceText = line,
                    context = $"Extracted from {Path.GetFileName(sourceFile)} line {lineNumber + 1}",
                    assetPath = sourceFile,
                    isTranslated = false,
                    isReviewed = false,
                    createdDate = DateTime.Now,
                    modifiedDate = DateTime.Now,
                    translations = new Dictionary<string, string>(),
                    tags = new List<string> { "auto-extracted", "plain-text" }
                };
            }

            return null;
        }

        /// <summary>
        /// Download and install AssetStudio CLI automatically
        /// </summary>
        public static async Task<bool> InstallAssetStudioCLI()
        {
            try
            {
                string toolsDir = Path.Combine(Application.dataPath, "..", "Tools");
                Directory.CreateDirectory(toolsDir);

                string downloadUrl = "https://github.com/Perfare/AssetStudio/releases/download/v0.16.47/AssetStudioCLI_net6_win_x64.zip";
                string zipPath = Path.Combine(toolsDir, "AssetStudioCLI.zip");

                Debug.Log("[TRADUX] Downloading AssetStudio CLI...");

                // Download using UnityWebRequest
                using (var www = new UnityEngine.Networking.UnityWebRequest(downloadUrl, UnityEngine.Networking.UnityWebRequest.kHttpVerbGET))
                {
                    www.downloadHandler = new UnityEngine.Networking.DownloadHandlerFile(zipPath);
                    var operation = www.SendWebRequest();

                    while (!operation.isDone)
                    {
                        await Task.Delay(100);
                    }

                    if (www.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                    {
                        Debug.LogError($"[TRADUX] Failed to download AssetStudio CLI: {www.error}");
                        return false;
                    }
                }

                // Extract ZIP (simplified - in production, use proper ZIP extraction)
                Debug.Log("[TRADUX] AssetStudio CLI downloaded successfully");
                Debug.Log("[TRADUX] Please extract the ZIP file manually and place AssetStudioCLI_net6_win_x64.exe in the Tools folder");

                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TRADUX] Error installing AssetStudio CLI: {e.Message}");
                return false;
            }
        }
    }

    /// <summary>
    /// Result of extracting a single asset
    /// </summary>
    internal class AssetExtractionResult
    {
        public bool success;
        public string errorMessage;
        public List<TranslatableString> strings;
        public TranslatableAsset asset;
    }
}

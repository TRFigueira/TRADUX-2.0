# TRADUX 2.0 - Unity Package Documentation

## Overview

TRADUX 2.0 is a comprehensive CAT (Computer-Assisted Translation) tool designed specifically for Unity games. It provides automated text extraction, intelligent translation, and seamless integration with the Unity ecosystem.

## Features

### Core Features
- **Automated Text Extraction**: Extract translatable strings from Unity assets, scripts, and resources
- **AssetStudio CLI Integration**: Deep extraction from Unity .assets files
- **Intelligent Translation**: Context-aware translation with multiple API support
- **Unity Editor Integration**: Complete integration within Unity Editor
- **Runtime Translation System**: In-game localization system
- **Quality Assurance**: Automated quality checks and consistency validation
- **Translation Memory**: Reuse translations across projects
- **Glossary Management**: Maintain consistent terminology

### Unity-Specific Features
- **ScriptableObject Support**: Extract texts from ScriptableObjects
- **Prefab Analysis**: Parse UI prefabs for translatable content
- **Scene Analysis**: Extract texts from Unity scenes
- **Build Pipeline Integration**: Automatic injection during build
- **Addressables Support**: Work with Unity Addressables system
- **Multi-Platform Support**: Deploy translations to all Unity platforms

## Installation

### Via Unity Package Manager

1. Open Unity Package Manager (`Window > Package Manager`)
2. Click the `+` icon and select "Add package from git URL"
3. Enter: `https://github.com/TRFigueira/TRADUX-2.0.git`
4. Wait for the package to install

### Manual Installation

1. Clone or download the repository
2. Copy the `com.trf.tradux` folder to your project's `Packages` directory
3. Unity will automatically detect and import the package

## Quick Start

### 1. Basic Setup

```csharp
using TRADUX.Runtime.Core;

public class GameManager : MonoBehaviour
{
    void Start()
    {
        // Initialize TRADUX runtime
        TraduxRuntime.Initialize();
        
        // Load translations
        TraduxRuntime.LoadTranslationsFromResources("Tradux/Locales/en");
        TraduxRuntime.LoadTranslationsFromResources("Tradux/Locales/pt");
        
        // Set language
        TraduxRuntime.SetLanguage(SystemLanguage.Portuguese);
    }
}
```

### 2. Using Translated Text

```csharp
// Simple text retrieval
string welcomeText = TraduxRuntime.GetText("welcome_message");

// With fallback
string greeting = TraduxRuntime.GetText("greeting", "Hello!");

// With parameters
string scoreText = TraduxRuntime.GetText("score_format", "Score: {0}", playerScore);
```

### 3. Creating Translatable Components

```csharp
using UnityEngine;
using UnityEngine.UI;
using TRADUX.Runtime.Models;

public class TranslatableText : MonoBehaviour, ITraduxTextComponent
{
    [SerializeField] private string translationKey;
    [SerializeField] private string fallbackText;
    private Text textComponent;
    
    void Start()
    {
        textComponent = GetComponent<Text>();
        TraduxRuntime.RegisterTextComponent(this);
    }
    
    public string GetTranslationKey()
    {
        return translationKey;
    }
    
    public void UpdateText()
    {
        if (textComponent != null)
        {
            textComponent.text = TraduxRuntime.GetText(translationKey, fallbackText);
        }
    }
    
    public void SetFallbackText(string text)
    {
        fallbackText = text;
        UpdateText();
    }
    
    void OnDestroy()
    {
        TraduxRuntime.UnregisterTextComponent(this);
    }
}
```

## Editor Integration

### Accessing TRADUX Editor

1. Open via menu: `TRADUX > Open Translation Editor`
2. Or use keyboard shortcut: `Ctrl+Shift+T` (Windows) / `Cmd+Shift+T` (Mac)

### Editor Tabs

#### Project Tab
- View project information
- Scan for translatable assets
- Manage project settings

#### Extraction Tab
- Configure AssetStudio CLI
- Select assets for extraction
- Monitor extraction progress

#### Translation Tab
- Edit translations
- Auto-translate with APIs
- Review and approve translations

#### Quality Tab
- Run quality checks
- Fix common issues
- Validate consistency

#### Settings Tab
- Configure translation APIs
- Set extraction preferences
- Define quality rules

## AssetStudio CLI Integration

### Installation

1. Go to `TRADUX > Settings` tab
2. Click "Install AssetStudio CLI"
3. Follow the installation instructions
4. Restart Unity Editor

### Usage

1. Select assets in Project window
2. Right-click > `TRADUX > Extract Texts`
3. Or use `TRADUX > Extraction` tab for batch extraction

## Translation File Formats

### JSON Format

```json
{
  "translations": [
    {
      "language": "en",
      "key": "welcome_message",
      "text": "Welcome to the game!"
    },
    {
      "language": "pt",
      "key": "welcome_message", 
      "text": "Bem-vindo ao jogo!"
    }
  ]
}
```

## Runtime System

### Language Management

```csharp
// Get current language
SystemLanguage current = TraduxRuntime.GetCurrentLanguage();

// Change language
TraduxRuntime.SetLanguage(SystemLanguage.Spanish);

// Get available languages
List<SystemLanguage> languages = TraduxRuntime.GetAvailableLanguages();
```

## API Integration

### Google Translate

```csharp
// In TRADUX Settings > Translation API
// Provider: Google
// API Key: YOUR_GOOGLE_TRANSLATE_API_KEY
// Auto Translate: Enabled
```

## Quality Assurance

### Built-in Checks

- **Text Overflow**: Detects text that doesn't fit in UI elements
- **Missing Translations**: Identifies untranslated strings
- **Consistency**: Ensures consistent terminology
- **Formatting**: Validates placeholder formatting
- **Placeholders**: Checks for missing or incorrect placeholders

## Support

- **Documentation**: https://github.com/TRFigueira/TRADUX-2.0
- **Issues**: https://github.com/TRFigueira/TRADUX-2.0/issues
- **Discussions**: https://github.com/TRFigueira/TRADUX-2.0/discussions

## License

MIT License - see LICENSE file for details.

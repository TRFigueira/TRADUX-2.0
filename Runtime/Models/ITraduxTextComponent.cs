using UnityEngine;
using System.Collections.Generic;

namespace TRADUX.Runtime.Models
{
    /// <summary>
    /// Interface for components that can be translated
    /// </summary>
    public interface ITraduxTextComponent
    {
        /// <summary>
        /// Get the translation key for this component
        /// </summary>
        string GetTranslationKey();
        
        /// <summary>
        /// Update the component's text with the current translation
        /// </summary>
        void UpdateText();
        
        /// <summary>
        /// Set fallback text if no translation is found
        /// </summary>
        void SetFallbackText(string text);
    }
}

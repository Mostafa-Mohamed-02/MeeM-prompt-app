import React, { useState, useCallback, useEffect, createRef, useRef } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import Loader from './components/Loader';
import AttributeSelectors from './components/AttributeSelectors';
import FinalPromptDisplay from './components/FinalPromptDisplay';
import JsonPromptDisplay from './components/JsonPromptDisplay';
import ModelSelector from './components/ModelSelector';
import InspirationStep from './components/InspirationStep';
import InspirationGallery from './components/InspirationGallery';
import MultiImageInput from './components/MultiImageInput';
import LanguageSelector from './components/LanguageSelector';
import FacebookIcon from './components/FacebookIcon';
import LinkedInIcon from './components/LinkedInIcon';
import HistoryPanel from './components/HistoryPanel';
import ToastContainer from './components/ToastContainer';
import { historyService } from './services/historyService';
import { useLocalization } from './hooks/useLocalization';
import { cropImage } from './utils/imageUtils';
import { 
  analyzeImageWithGemini, 
  generateFinalPromptWithGemini,
  findWebInspiration,
  generateInspirationsWithGemini,
  regenerateFinalPromptWithGemini,
  generateInspirationsFromComposition,
  analyzeCompositionForAttributes,
  generateMergedArtisticPromptFromParts,
  generateFinalPromptFromAttributes,
  initializeGeminiAPI,
} from './services/geminiService';
import { analyzeImageWithOllama, generateFinalPromptWithOllama, fetchOllamaModels, regenerateFinalPromptWithOllama, analyzeCompositionForAttributesWithOllama, generateFinalPromptFromAttributesWithOllama, generateMergedArtisticPromptFromPartsWithOllama } from './services/ollamaService';
import { DetectedAttributes, FinalPrompt, ModelConfig, WebInspiration, MultiImageInputState, HistoryItem, attributeOptions } from './types';

type AppStep = 'uploading' | 'choosePath' | 'findingInspiration' | 'generatingInspirations' | 'analyzingComposition' | 'showingInspiration' | 'analyzing' | 'analyzed' | 'generatingPrompt' | 'showingPrompt';
type AppTab = 'input' | 'model';
type InputMode = 'single' | 'multi' | 'text';
type AnalysisSource = 'single' | 'composition';

const App: React.FC = () => {
  // sound effects removed
  // Simple heuristic extractor: scan merged prompt text for known attribute options
  const extractAttributesFromText = (text: string) => {
    const lower = (text || '').toLowerCase();
    const attrs: Partial<DetectedAttributes> = {};
    (Object.keys(attributeOptions) as Array<keyof typeof attributeOptions>).forEach((cat) => {
      const opts = attributeOptions[cat];
      const found = opts.filter(opt => {
        try {
          return lower.includes(opt.toLowerCase());
        } catch (e) { return false; }
      });
      attrs[cat] = found.slice();
    });
    return attrs as DetectedAttributes;
  };
  const [activeTab, setActiveTab] = useState<AppTab>('input');
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [textDescription, setTextDescription] = useState<string>('');
  const [forceMergedFlow, setForceMergedFlow] = useState<boolean>(true);

  // Handle history panel and image syncing
  const handleHistorySelect = useCallback((historyItem: HistoryItem) => {
    // Create a File object from the stored dataUrl so the MIME type is preserved
    (async () => {
      try {
        if (historyItem.dataUrl) {
          const match = historyItem.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mime = match[1];
            const b64 = match[2];
            const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const fileName = historyItem.fileName || `image-${Date.now()}`;
            const file = new File([binary], fileName, { type: mime });
            setUploadedImage({ dataUrl: historyItem.dataUrl, file });
            setAppStep('choosePath');
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to construct File from history dataUrl', e);
      }

      // Fallback if dataUrl is missing or couldn't be parsed
      setUploadedImage({ dataUrl: historyItem.dataUrl || '', file: new File([], historyItem.fileName) });
      setAppStep('choosePath');
    })();
  }, []);
  
  const [uploadedImage, setUploadedImage] = useState<{ dataUrl: string; file: File } | null>(null);
  const [multiImageInputs, setMultiImageInputs] = useState<MultiImageInputState[]>([]);
  const [detectedAttributes, setDetectedAttributes] = useState<DetectedAttributes | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<FinalPrompt | null>(null);
  const [inspirationImages, setInspirationImages] = useState<WebInspiration[] | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(null);

  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'gemini',
    gemini: {
      model: 'gemini-2.5-flash',
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: '',
      models: [],
    },
  });

  // On startup, if an API key was injected via environment variables (from .env.local),
  // load it into the UI state and initialize the Gemini service.
  useEffect(() => {
    try {
    const extraInstr = (selectedModelKey === 'sdxl') ? `${sdxlPromptGuidelines} ${modelInstructions[selectedModelKey]}` : modelInstructions[selectedModelKey];
      // Vite's define plugin replaced process.env.GEMINI_API_KEY at dev-time. Use as any to avoid TS errors.
      const envKey = (process as any)?.env?.GEMINI_API_KEY;
      if (envKey) {
        setModelConfig(prev => ({
          ...prev,
          gemini: {
            ...prev.gemini,
            apiKey: envKey,
          }
        }));
        try {
          initializeGeminiAPI(envKey);
        } catch (e) {
          console.warn('Failed to initialize Gemini API from env key:', e);
        }
      }
    } catch (e) {
      // ignore; environment variable not available
    }
  }, []);

  const [appStep, setAppStep] = useState<AppStep>('uploading');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Text input for user-supplied instructions to re-run/regenerate prompts
  const [rePromptInstruction, setRePromptInstruction] = useState<string>('');
  const [selectedModelKey, setSelectedModelKey] = useState<'chatgpt'|'qwen'|'imagine4'|'flux'|'sdxl'>('chatgpt');

  const modelInstructions: Record<string, string> = {
    chatgpt: `Craft clear, specific, and well-contextualized prompts with enough background for accurate results. Avoid ambiguity; precisely define task, context, constraints, and expected output format. Specify tone, style, and formatting. Use logical prompt structure (Context, Task, Format) and provide examples when helpful.`,
    qwen: `Start with Subject + Scene + Style. Expand to: Subject (detailed) + Scene (environment) + Style + Lens language + Atmosphere + Detail modifiers. Use natural descriptive language; specify framing, lens, lighting, mood, and exact text in double quotes for captions. Break complex scenes into layered descriptions.`,
    imagine4: `Use full, clear sentences describing subject, environment, lighting, mood and fine detail. Specify textures, colors, time of day, spatial relationships and emotional tone. Break prompt into physical characteristics, environment, and emotional tone.`,
    flux: `Write prompts in natural language like explaining to an artist. Use hierarchical structure: foreground → middle ground → background. Be precise about placement, color palette, style, tone and transitions. Specify textures/materials and text styles for text in images. Avoid weight syntax; prefer phrases like "with emphasis on".`,
    sdxl: `Use rich descriptive language with technical artistic directions: lighting, rendering style, color palette. Optionally use dual prompts (subject + style). Avoid vague descriptors and include quality keywords like 8k, sharp focus, cinematic lighting.`
  };
  // SDXL-specific prompt guidelines (applied when SDXL is selected)
  const sdxlPromptGuidelines = [
    'Follow SDXL prompt formatting: always start prompts with (high quality), (masterpiece), (detailed), 8K;',
    'Always include weight values using parentheses next to keywords, range 0.2-2.0 (example: (subject1.2));',
    'Do not use particle words: a, an, is, the, of, to; avoid narrative or poetic language; use concise visual shorthand;',
    'Use keyword categories: [SUBJECT],[MEDIUM],[STYLE],[INSPIRATION],[RESOLUTION],[COLOR],[LIGHTING],[ADDITIONAL DETAILS],[TRENDING] in that order when applicable;',
    'If $photo trigger applied, include exact camera and lens near end of prompt; if $ins or $trend triggers applied include artist or site accordingly;'
  ].join(' ');
  const { t, language } = useLocalization();

  // Helper to create an empty DetectedAttributes object (all categories -> empty array)
  const createEmptyAttributes = (): DetectedAttributes => {
    const empty: Partial<DetectedAttributes> = {};
    (Object.keys(attributeOptions) as Array<keyof typeof attributeOptions>).forEach((k) => {
      empty[k] = [];
    });
    return empty as DetectedAttributes;
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const seenHashesRef = useRef<Set<string>>(new Set());
  const prevMultiRef = useRef<MultiImageInputState[]>([]);

  useEffect(() => {
    // Handle RTL layout for Arabic
    if (language === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setError(null);
    // Reset to a sensible state
    if (detectedAttributes) setAppStep('analyzed');
    else if (inspirationImages) setAppStep('showingInspiration');
    else if (uploadedImage || multiImageInputs.length > 0) setAppStep('choosePath');
    else setAppStep('uploading');
  };

  const resetState = useCallback((keepInputs = false) => {
    if (!keepInputs) {
      setUploadedImage(null);
      setMultiImageInputs([]);
    }
    setDetectedAttributes(null);
    setGeneratedPrompt(null);
    setInspirationImages(null);
    setError(null);
    setAnalysisSource(null);
    setAppStep(keepInputs && (uploadedImage || multiImageInputs.length > 0) ? 'choosePath' : 'uploading');
  }, [uploadedImage, multiImageInputs]);

  const handleError = useCallback((err: unknown, defaultMessage: string) => {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log("Generation stopped by user.");
      return; // Don't set an error message for user cancellation
    }
    
    let message = err instanceof Error ? err.message : defaultMessage;
    console.error(err);

    // Check for Gemini API quota error and provide a user-friendly message
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      message = "You've exceeded your free API quota. Please wait and try again later, or reduce the number of requested inspirations in the 'AI Model Configuration' tab.";
    }

    setError(message);
    setIsLoading(false);
    
    if (detectedAttributes) setAppStep('analyzed');
    else if (inspirationImages) setAppStep('showingInspiration');
    else if (uploadedImage || multiImageInputs.length > 0) setAppStep('choosePath');
    else setAppStep('uploading');
  }, [detectedAttributes, uploadedImage, multiImageInputs, inspirationImages]);

  // Watch uploadedImage and multiImageInputs to persist any newly inserted images to history
  useEffect(() => {
    const trySaveUploaded = async () => {
      if (!uploadedImage) return;
      try {
        // compute hash quickly via historyService helper by saving transiently
        // prefer file if available
        if (uploadedImage.file && uploadedImage.file.size) {
          await historyService.saveImageBackground(uploadedImage.file);
        } else if (uploadedImage.dataUrl) {
          await historyService.saveDataUrlBackground(uploadedImage.dataUrl);
        }
      } catch (e) {
        console.debug('Auto-save uploadedImage to history failed', e);
      }
    };

    const trySaveMulti = async () => {
      const prev = prevMultiRef.current;
      // detect new or changed items
      for (const item of multiImageInputs) {
        const prevItem = prev.find(p => p.id === item.id);
        if (!prevItem) {
          // new slot: save if it has dataUrl or a file
          try {
            if (item.file && item.file.size) await historyService.saveImageBackground(item.file);
            else if (item.dataUrl) await historyService.saveDataUrlBackground(item.dataUrl);
          } catch (e) { console.debug('Auto-save multi new item failed', e); }
        } else if (item.dataUrl && item.dataUrl !== prevItem.dataUrl) {
          // replaced image in the same slot
          try { await historyService.saveDataUrlBackground(item.dataUrl); } catch (e) { console.debug('Auto-save multi replaced item failed', e); }
        }
      }
      prevMultiRef.current = multiImageInputs.slice();
    };

    trySaveUploaded();
    trySaveMulti();
  }, [uploadedImage, multiImageInputs]);
  
  const runAnalysis = useCallback(async (base64Data: string, mimeType: string, newFileForState: File, newDataUrlForState: string, signal: AbortSignal) => {
    setUploadedImage({ dataUrl: newDataUrlForState, file: newFileForState });
    setAnalysisSource('single');

    let attributes: DetectedAttributes;
    if (modelConfig.provider === 'gemini') {
      // Gemini SDK doesn't natively support AbortSignal on generateContent
      attributes = await analyzeImageWithGemini(base64Data, mimeType, modelConfig.gemini.model);
    } else {
      attributes = await analyzeImageWithOllama(base64Data, modelConfig.ollama, signal);
    }

    if (signal.aborted) return;
    
    setDetectedAttributes(attributes);
    setAppStep('analyzed');
  }, [modelConfig]);

  // Build composition inputs, cropping masked regions when available
  const buildCompositionInputs = useCallback(async (items: MultiImageInputState[]) => {
    const parts = await Promise.all(items.map(async (input) => {
      try {
        if (input.mask && input.imageRef && input.imageRef.current) {
          // Crop the masked region and send that as the part
          const cropped = await cropImage(input.dataUrl, input.imageRef.current, input.mask);
          return { base64: cropped.base64, mimeType: cropped.mimeType, prompt: input.prompt || '', isCropped: true };
        }
      } catch (e) {
        console.warn('Failed to crop masked region, falling back to full image', e);
      }

  // Fallback: use the full image
  return { base64: input.dataUrl.split(',')[1], mimeType: input.file.type, prompt: input.prompt || '', isCropped: false };
    }));

    return parts;
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    setInspirationImages(null); // Clear inspirations if analyzing directly

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAppStep('analyzing');
    setIsLoading(true);
    setError(null);
    setLoadingMessage(t('loaderAnalyzing'));

    try {
      if (inputMode === 'multi' && multiImageInputs.length > 0) {
        // Handle multi-image analysis
        const inputs = await buildCompositionInputs(multiImageInputs);

        const attributes = modelConfig.provider === 'gemini'
          ? await analyzeCompositionForAttributes(inputs, modelConfig.gemini.model)
          : await analyzeCompositionForAttributesWithOllama(inputs, modelConfig.ollama, controller.signal);
          
        if (controller.signal.aborted) return;
        setDetectedAttributes(attributes);
        setAnalysisSource('composition');
        setAppStep('analyzed');
      } else if (uploadedImage) {
        // Handle single image analysis
        const base64Data = uploadedImage.dataUrl.split(',')[1];
        let mimeType = uploadedImage.file.type;
        if (!mimeType && uploadedImage.dataUrl) {
          const m = uploadedImage.dataUrl.match(/^data:([^;]+);base64,/);
          mimeType = m ? m[1] : 'image/png';
        }
        await runAnalysis(base64Data, mimeType, uploadedImage.file, uploadedImage.dataUrl, controller.signal);
      } else {
        throw new Error("No images uploaded.");
      }
    } catch (err) {
        handleError(err, "An unexpected error occurred during analysis.");
    } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsLoading(false);
    }
  }, [uploadedImage, multiImageInputs, inputMode, modelConfig, runAnalysis, handleError, t]);

  const handleImageChange = useCallback(async (dataUrl: string, file: File) => {
    resetState();

    // Immediately show the uploaded image for snappy UI
    setUploadedImage({ dataUrl, file });

    // Save to history in background (non-blocking)
    try {
      historyService.saveImageBackground(file);
    } catch (e) {
      // ignore background save errors
      console.debug('background save failed', e);
    }

    setAnalysisSource('single');
    setAppStep('choosePath');
  }, [resetState]);
  
  const handleFindInspiration = async () => {
    if (!uploadedImage) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAppStep('findingInspiration');
    setIsLoading(true);
    setLoadingMessage(t('loaderSearchingInspiration'));
    setError(null);
    try {
    const base64Data = uploadedImage.dataUrl.split(',')[1];
    let mimeType = uploadedImage.file.type;
    if (!mimeType && uploadedImage.dataUrl) {
      const m = uploadedImage.dataUrl.match(/^data:([^;]+);base64,/);
      mimeType = m ? m[1] : 'image/png';
    }
  const inspirations = await findWebInspiration(base64Data, mimeType, modelConfig.gemini.model, 3);

        if (controller.signal.aborted) return;
        
        if (inspirations.length === 0) {
          setError("Could not find any inspiration images. Please try analyzing your image directly.");
          setAppStep('choosePath');
        } else {
          setInspirationImages(inspirations);
          setAppStep('showingInspiration');
        }
    } catch (err) {
        handleError(err, "Failed to find web inspiration.");
    } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsLoading(false);
    }
  };

  const handleGenerateInspirations = async () => {
    if (!uploadedImage) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setAppStep('generatingInspirations');
    setIsLoading(true);
    setLoadingMessage(t('loaderGeneratingConcepts'));
    setError(null);
    try {
    const base64Data = uploadedImage.dataUrl.split(',')[1];
    let mimeType = uploadedImage.file.type;
    if (!mimeType && uploadedImage.dataUrl) {
      const m = uploadedImage.dataUrl.match(/^data:([^;]+);base64,/);
      mimeType = m ? m[1] : 'image/png';
    }
  const inspirations = await generateInspirationsWithGemini(base64Data, mimeType, modelConfig.gemini.model, 3);
        
        if (controller.signal.aborted) return;

        if (inspirations.length === 0) {
          setError("Could not generate any new concepts. Please try analyzing your image directly.");
          setAppStep('choosePath');
        } else {
          setInspirationImages(inspirations);
          setAppStep('showingInspiration');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "";

        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
          console.warn("AI generation quota exceeded. Falling back to web inspiration search.");
          setLoadingMessage("AI quota limit reached. Searching the web for inspiration instead...");

          try {
            const base64Data = uploadedImage.dataUrl.split(',')[1];
            let mimeType = uploadedImage.file.type;
            if (!mimeType && uploadedImage.dataUrl) {
              const m = uploadedImage.dataUrl.match(/^data:([^;]+);base64,/);
              mimeType = m ? m[1] : 'image/png';
            }
            const webInspirations = await findWebInspiration(base64Data, mimeType, modelConfig.gemini.model, 3);
            
            if (controller.signal.aborted) return;

            if (webInspirations.length === 0) {
              setError("Could not find any inspiration images, even with web fallback. Please try analyzing your image directly.");
              setAppStep('choosePath');
            } else {
              setInspirationImages(webInspirations);
              setAppStep('showingInspiration');
            }
          } catch (fallbackErr) {
            handleError(fallbackErr, "Web inspiration fallback failed after hitting API quota.");
          }

        } else {
          handleError(err, "Failed to generate new inspirations.");
        }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleInspirationSelect = useCallback(async (selected: WebInspiration) => {
    if (!uploadedImage) return;
    
    if (selected.uri === uploadedImage.dataUrl) {
      await handleStartAnalysis();
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setLoadingMessage(t('loaderPreparingImage'));
    setError(null);
    
    try {
      const isDataUrl = selected.uri.startsWith('data:');
      const urlToFetch = isDataUrl ? selected.uri : `https://i.microlink.io/${selected.uri}`;
      
      const response = await fetch(urlToFetch, { signal: controller.signal });
      if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);
      
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Fetched image is empty.");
      
      const mimeType = blob.type || 'image/jpeg';
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });

      if (controller.signal.aborted) return;

      const base64Data = dataUrl.split(',')[1];
      const newFile = new File([blob], selected.title || 'web-image.jpg', { type: mimeType });
      
      setAppStep('analyzing');
      setLoadingMessage(t('loaderAnalyzing'));

      await runAnalysis(base64Data, mimeType, newFile, dataUrl, controller.signal);

    } catch(err) {
      handleError(err, "Could not load the selected inspiration. It might be protected or invalid.");
      setAppStep('showingInspiration');
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [uploadedImage, handleStartAnalysis, runAnalysis, handleError, t]);

  const handleGoBackToInspirations = useCallback(() => {
    setAppStep('showingInspiration');
    setDetectedAttributes(null);
    setError(null);
  }, []);

  const handleAttributeChange = (updatedAttributes: DetectedAttributes) => {
    setDetectedAttributes(updatedAttributes);
    // Don't clear generatedPrompt or change appStep here to keep controls visible
  };

  const handleGeneratePrompt = async () => {
    // If in Text mode, use the textDescription and selected attributes to generate the prompt
    if (inputMode === 'text') {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setAppStep('generatingPrompt');
      setIsLoading(true);
      setError(null);
      setGeneratedPrompt(null);
      setLoadingMessage(t('loaderCraftingPrompt'));

      try {
        const attrs = detectedAttributes || createEmptyAttributes();
        const extraInstr = (selectedModelKey === 'sdxl') ? `${sdxlPromptGuidelines} ${modelInstructions[selectedModelKey]}` : modelInstructions[selectedModelKey];
        let result: FinalPrompt;

        if (modelConfig.provider === 'gemini') {
          // For Gemini, we can reuse generateFinalPromptFromAttributes by passing a subject in the attributes json
          const attrsWithSubject = { ...attrs, subject: [textDescription] } as any;
          // generateFinalPromptFromAttributes expects DetectedAttributes and returns FinalPrompt
          result = await generateFinalPromptFromAttributes(attrsWithSubject as DetectedAttributes, modelConfig.gemini.model, extraInstr);
        } else {
          // Ollama variant
          const attrsWithSubject = { ...attrs, subject: [textDescription] } as any;
          result = await generateFinalPromptFromAttributesWithOllama(attrsWithSubject as DetectedAttributes, modelConfig.ollama, undefined as any);
        }

        if (controller.signal.aborted) return;

        setGeneratedPrompt(result);
        setAppStep('showingPrompt');
      } catch (err) {
        handleError(err, "An unexpected error occurred while generating the prompt from text.");
      } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsLoading(false);
      }

      return;
    }
    // Multi-image quick flow: generate per-image prompts and merge them, bypassing attribute refinement
    if (inputMode === 'multi' && multiImageInputs.length > 0) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setAppStep('generatingPrompt');
      setIsLoading(true);
      setError(null);
      setGeneratedPrompt(null);
      setLoadingMessage(t('loaderCraftingPrompt'));

      try {
        const inputs = await buildCompositionInputs(multiImageInputs);

        if (modelConfig.provider === 'gemini') {
          const mergedPromptText = await generateMergedArtisticPromptFromParts(inputs, modelConfig.gemini.model);
          if (controller.signal.aborted) return;

          // Extract any known attribute keywords from merged prompt text to populate jsonPrompt
          const extracted = extractAttributesFromText(mergedPromptText);
          setGeneratedPrompt({ artisticPrompt: mergedPromptText, jsonPrompt: { subject: mergedPromptText, ...extracted } });
          setAppStep('showingPrompt');
        } else {
          // Ollama: if forceMergedFlow is enabled, use the merged per-part helper; otherwise fallback to analyze+generate
          if (forceMergedFlow) {
            const mergedPromptText = await generateMergedArtisticPromptFromPartsWithOllama(inputs as any, modelConfig.ollama, controller.signal);
            if (controller.signal.aborted) return;
            const extracted = extractAttributesFromText(mergedPromptText);
            setGeneratedPrompt({ artisticPrompt: mergedPromptText, jsonPrompt: { subject: mergedPromptText, ...extracted } });
            setAppStep('showingPrompt');
          } else {
            const compositionAttributes = await analyzeCompositionForAttributesWithOllama(inputs as any, modelConfig.ollama, controller.signal);
            if (controller.signal.aborted) return;
            const final = await generateFinalPromptFromAttributesWithOllama(compositionAttributes, modelConfig.ollama, controller.signal);
            setGeneratedPrompt(final);
            setAppStep('showingPrompt');
          }
        }
      } catch (err) {
        handleError(err, "Failed to generate prompt for multi-image composition.");
        setAppStep('analyzed');
      } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsLoading(false);
      }

      return;
    }

    if (!detectedAttributes) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAppStep('generatingPrompt');
    setIsLoading(true);
    setError(null);
    setGeneratedPrompt(null);
    setLoadingMessage(t('loaderCraftingPrompt'));
    
  const extraInstr = (selectedModelKey === 'sdxl') ? `${sdxlPromptGuidelines} ${modelInstructions[selectedModelKey]}` : modelInstructions[selectedModelKey];

  try {
      let result: FinalPrompt;

      if (analysisSource === 'composition') {
        // Handle composition that came from attribute refinement
        if (multiImageInputs.length > 0) {
          const inputs = await buildCompositionInputs(multiImageInputs);
          
          // First analyze the composition
          const compositionAttributes = modelConfig.provider === 'gemini'
            ? await analyzeCompositionForAttributes(inputs, modelConfig.gemini.model)
            : await analyzeCompositionForAttributesWithOllama(inputs, modelConfig.ollama, controller.signal);
          
          // Then generate the final prompt
          result = modelConfig.provider === 'gemini'
            ? await generateFinalPromptFromAttributes(compositionAttributes, modelConfig.gemini.model, extraInstr)
            : await generateFinalPromptFromAttributesWithOllama(compositionAttributes, modelConfig.ollama, controller.signal);
        } else {
          if (modelConfig.provider === 'gemini') {
            result = await generateFinalPromptFromAttributes(detectedAttributes, modelConfig.gemini.model, extraInstr);
          } else {
            result = await generateFinalPromptFromAttributesWithOllama(detectedAttributes, modelConfig.ollama, controller.signal);
          }
        }
      } else if (analysisSource === 'single' && uploadedImage) {
        const base64Data = uploadedImage.dataUrl.split(',')[1];
        let mimeType = uploadedImage.file.type;
        if (!mimeType && uploadedImage.dataUrl) {
          const m = uploadedImage.dataUrl.match(/^data:([^;]+);base64,/);
          mimeType = m ? m[1] : 'image/png';
        }
        if (modelConfig.provider === 'gemini') {
          result = await generateFinalPromptWithGemini(base64Data, mimeType, detectedAttributes, modelConfig.gemini.model, extraInstr);
        } else {
          result = await generateFinalPromptWithOllama(base64Data, detectedAttributes, modelConfig.ollama, controller.signal);
        }
      } else {
        throw new Error("Invalid state: analysis source is not set correctly.");
      }

      if (controller.signal.aborted) return;

      setGeneratedPrompt(result);
      setAppStep('showingPrompt');
    } catch (err) {
        handleError(err, "An unexpected error occurred while generating the prompt.");
        // Keep same app step to maintain UI state
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleRegeneratePrompt = async (editedText: string) => {
    if (!detectedAttributes) return;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setAppStep('generatingPrompt');
    setIsLoading(true);
    setError(null);
    setGeneratedPrompt(null);
    setLoadingMessage(t('loaderRegeneratingPrompt'));

    try {
      const extraInstr = modelInstructions[selectedModelKey];
      let result: FinalPrompt;
      if (modelConfig.provider === 'gemini') {
        result = await regenerateFinalPromptWithGemini(editedText, detectedAttributes, modelConfig.gemini.model, extraInstr);
      } else {
        result = await regenerateFinalPromptWithOllama(editedText, detectedAttributes, modelConfig.ollama, controller.signal);
      }

      if (controller.signal.aborted) return;

      setGeneratedPrompt(result);
      setAppStep('showingPrompt');
    } catch (err) {
      handleError(err, "An unexpected error occurred while regenerating the prompt.");
      setAppStep('analyzed');
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // --- Multi-Image Handlers ---
  const addMultiImageInput = () => {
    setMultiImageInputs(prev => [...prev, { id: Date.now().toString(), dataUrl: '', file: new File([], ""), mask: null, prompt: '', imageRef: createRef<HTMLImageElement>() }]);
    if (appStep === 'uploading') setAppStep('choosePath');
  };

  const updateMultiImageInput = (id: string, updates: Partial<MultiImageInputState>) => {
    let fileToSave: File | null = null;
    let dataUrlToSave: string | null = null;
    
    // Capture previous item for change detection
    let previousItem: MultiImageInputState | undefined;

    setMultiImageInputs(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          previousItem = item;
          const merged = { ...item, ...updates };
          // choose file from updates first, otherwise from merged state
          const f = (updates.file as File) || (merged.file as File);
          if (f && f.size) {
            fileToSave = f;
          } else if (updates.dataUrl) {
            dataUrlToSave = updates.dataUrl;
          }
          return merged;
        }
        return item;
      });
      return next;
    });

    // If a new mask was added (or changed) trigger a background crop + single-image analysis
    try {
      const newMask = updates.mask;
      // Compare to previous mask to avoid duplicate work
      const prevMask = previousItem?.mask ?? null;
      const masksDiffer = !!newMask && (!prevMask || (
        prevMask.x !== newMask.x || prevMask.y !== newMask.y || prevMask.width !== newMask.width || prevMask.height !== newMask.height
      ));

      if (newMask && masksDiffer) {
        // Mask changed — do NOT auto-run analysis here.
        // Previously we ran a background crop + runAnalysis which caused the app
        // to start refining attributes automatically as soon as the user drew a mask.
        // That behavior was surprising; analysis should only run when the user
        // explicitly clicks the "Refine Attributes" button. Leave the mask in
        // state and let the user trigger analysis.
      }
    } catch (e) {
      console.debug('Error while attempting background mask analysis', e);
    }

    // Save to history - prioritize file over dataUrl
    if (fileToSave) {
      try {
        historyService.saveImageBackground(fileToSave);
      } catch (e) {
        console.debug('Failed to save multi-image input to history in background', e);
        // If file save fails, try dataUrl as fallback
        if (dataUrlToSave) {
          try {
            historyService.saveDataUrlBackground(dataUrlToSave);
          } catch (e) {
            console.debug('Failed to save multi-image dataUrl to history in background', e);
          }
        }
      }
    } else if (dataUrlToSave) {
      // save when only a dataUrl is provided (no File object)
      try {
        historyService.saveDataUrlBackground(dataUrlToSave);
      } catch (e) {
        console.debug('Failed to save multi-image dataUrl to history in background', e);
      }
    }
  };
  
  const removeMultiImageInput = (id: string) => {
    setMultiImageInputs(prev => {
        const newState = prev.filter(item => item.id !== id);
        if(newState.length === 0) setAppStep('uploading');
        return newState;
    });
  };

  const handleGenerateInspirationsFromComposition = async () => {
    const validInputs = multiImageInputs.filter(item => item.dataUrl && item.mask && item.imageRef?.current);
    if (validInputs.length === 0) {
      setError("Please add at least one image and draw a mask to generate a composition.");
      return;
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAppStep('analyzingComposition');
    setIsLoading(true);
    setLoadingMessage(t('loaderComposingConcepts'));
    setError(null);

    try {
      const compositionParts = await Promise.all(
        validInputs.map(async input => {
          const { base64, mimeType } = await cropImage(input.dataUrl, input.imageRef!.current!, input.mask!);
          return { base64, mimeType, prompt: input.prompt };
        })
      );
      
      if (controller.signal.aborted) return;

  const inspirations = await generateInspirationsFromComposition(compositionParts, modelConfig.gemini.model, 3);

      if (controller.signal.aborted) return;

      setInspirationImages(inspirations);
      const firstInput = multiImageInputs[0];
      setUploadedImage({ dataUrl: firstInput.dataUrl, file: firstInput.file });
      setAppStep('showingInspiration');

    } catch (err) {
      handleError(err, "Failed to generate inspirations from composition.");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleAnalyzeComposition = async () => {
    const validInputs = multiImageInputs.filter(item => item.dataUrl && item.mask && item.imageRef?.current);
    if (validInputs.length === 0) {
      setError("Please add at least one image and draw a mask to analyze a composition.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAppStep('analyzingComposition');
    setIsLoading(true);
    setLoadingMessage(t('loaderAnalyzingComposition'));
    setError(null);
    setGeneratedPrompt(null);
    
    try {
      const compositionParts = await Promise.all(
        validInputs.map(async input => {
          const { base64, mimeType } = await cropImage(input.dataUrl, input.imageRef!.current!, input.mask!);
          return { base64, mimeType, prompt: input.prompt };
        })
      );
      
      if (controller.signal.aborted) return;

      let attributes: DetectedAttributes;
      if (modelConfig.provider === 'gemini') {
        attributes = await analyzeCompositionForAttributes(compositionParts, modelConfig.gemini.model);
      } else {
        attributes = await analyzeCompositionForAttributesWithOllama(compositionParts, modelConfig.ollama, controller.signal);
      }
      
      if (controller.signal.aborted) return;

      setDetectedAttributes(attributes);
      setAnalysisSource('composition');
      setUploadedImage(null);
      setInspirationImages(null);
      setAppStep('analyzed');
    } catch (err) {
      handleError(err, "Failed to analyze composition.");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsLoading(false);
    }
  };
  
  const handleModelConfigChange = async (newConfig: ModelConfig) => {
    setModelConfig(newConfig);
    if (newConfig.provider === 'gemini' && newConfig.gemini.apiKey) {
      try {
        initializeGeminiAPI(newConfig.gemini.apiKey);
        setError(null); // Clear any previous API errors
      } catch (err) {
        setError(t('geminiApiInitError'));
      }
    }
  };

  const handleFetchOllamaModels = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setError(null);
    try {
      const models = await fetchOllamaModels(modelConfig.ollama, controller.signal);
      
      if (controller.signal.aborted) return;

      setModelConfig(prev => ({
        ...prev,
        ollama: {
          ...prev.ollama,
          models: models,
          model: models.includes(prev.ollama.model) ? prev.ollama.model : (models[0] || '')
        }
      }));
    } catch (err) {
       handleError(err, "Failed to fetch Ollama models.");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }, [modelConfig.ollama, handleError]);
  
  // Show selectors when in analyzed/showingPrompt/generatingPrompt or when in text mode (attributes editable)
  // But never show these when the active tab is the Model configuration panel.
  const showSelectors = (activeTab === 'input') && (['analyzed', 'generatingPrompt', 'showingPrompt'].includes(appStep) || inputMode === 'text');
  const showGenerateButton = (activeTab === 'input') && (appStep === 'analyzed' || appStep === 'showingPrompt' || appStep === 'generatingPrompt' || inputMode === 'text');

  return (
    <div className="min-h-screen flex flex-col bg-black font-body text-gray-100 fade-in">
      <ToastContainer />
      <main className="flex-grow w-full px-0 py-0 sm:py-0 flex flex-col">
        <div className="flex justify-center flex-grow">
          <div className="w-full rounded-none bg-gradient-to-r from-purple-700 via-violet-800 to-blue-700 p-8 flex flex-col min-h-full">
            <div className="rounded-lg bg-black p-6">
              <div className="space-y-8">
                <Header onHistorySelect={handleHistorySelect} />
          
          <div className="text-center">
            <p className="max-w-3xl mx-auto text-gray-400">
             {t('appDescription')}
            </p>
          </div>

          {/* Tabs */}
          <div className="w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
              onClick={() => setActiveTab('input')}
              className={`btn-bubbled relative overflow-hidden p-6 rounded-lg border-2 transition-all duration-300 flex items-center gap-4 text-left group
                ${activeTab === 'input' 
                  ? 'bg-gray-900 border-white shadow-glow' 
                  : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                }
              `}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle,_transparent_10%,_rgba(139,92,246,0.1)_50%)] animate-[pulse_3s_ease-in-out_infinite]"></div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 flex-shrink-0 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="relative">
                <h3 className="font-bold text-lg text-white">{t('imageInputsTab')}</h3>
                <p className="text-sm">{t('imageInputsTabDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('model')}
              className={`btn-bubbled p-6 rounded-lg border-2 transition-all duration-300 flex items-center gap-4 text-left ${activeTab === 'model' ? 'bg-gray-900 border-white shadow-glow' : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <h3 className="font-bold text-lg text-white">{t('modelConfigTab')}</h3>
                <p className="text-sm">{t('modelConfigTabDesc')}</p>
              </div>
            </button>
          </div>

          <div className={activeTab === 'model' ? '' : 'hidden'}>
            <ModelSelector 
              config={modelConfig} 
              onChange={handleModelConfigChange}
              onFetchModels={handleFetchOllamaModels}
              disabled={isLoading}
            />
          </div>
          
          <div className={activeTab === 'input' ? 'space-y-8' : 'hidden'}>
            <div className="flex justify-center items-center gap-4">
              <span className="text-gray-400 font-semibold">{t('modeLabel')}</span>
               <div className="flex bg-gray-900 p-1 rounded-lg">
          <button onClick={() => setInputMode('single')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${inputMode === 'single' ? 'bg-white text-black' : 'text-gray-300 hover:bg-gray-700'}`}>{t('singleImageMode')}</button>
          <button onClick={() => setInputMode('multi')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${inputMode === 'multi' ? 'bg-white text-black' : 'text-gray-300 hover:bg-gray-700'}`}>{t('multiImageMode')}</button>
          <button onClick={() => { setInputMode('text'); setDetectedAttributes(createEmptyAttributes()); setUploadedImage(null); }} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${inputMode === 'text' ? 'bg-white text-black' : 'text-gray-300 hover:bg-gray-700'}`}>Text</button>
               </div>
               {inputMode === 'multi' && (
                 <label className="ml-4 flex items-center gap-2 text-sm text-gray-400">
                   <input type="checkbox" checked={forceMergedFlow} onChange={(e) => setForceMergedFlow(e.target.checked)} />
                   {" "}{t('forceMergedFlow')}
                 </label>
               )}
            </div>
            
            {inputMode === 'single' && (
              <ImageUploader 
                  onImageChange={handleImageChange} 
                  onClear={() => resetState(false)}
                  disabled={isLoading}
                  imagePreviewUrl={uploadedImage?.dataUrl ?? null}
              />
            )}

            {inputMode === 'text' && (
              <div className="max-w-4xl mx-auto">
                <label className="block text-sm font-medium text-gray-300 mb-2">Describe the prompt you want to create</label>
                <textarea
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
                  placeholder="Write the scene, subject, style, mood, and any specifics..."
                  className="w-full bg-gray-900 text-gray-200 placeholder-gray-500 px-4 py-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 mb-4"
                  rows={6}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">You can also choose attributes below to refine the generated prompt.</p>
              </div>
            )}

            {/* Show analyzing indicator under the single image input while analyzing */}
            {inputMode === 'single' && isLoading && (appStep === 'analyzing' || appStep === 'analyzingComposition') && (
              <div className="w-full flex justify-center mt-4">
                <div className="text-sm text-gray-300 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                  <span>{t('loaderAnalyzing')}</span>
                </div>
              </div>
            )}

            {inputMode === 'multi' && (
              <div className="w-full mx-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {multiImageInputs.map(item => (
                        <MultiImageInput 
                            key={item.id}
                            item={item}
                            onUpdate={updateMultiImageInput}
                            onRemove={removeMultiImageInput}
                            disabled={isLoading}
                        />
                    ))}
                    {multiImageInputs.length < 4 && (
                        <button 
                            onClick={addMultiImageInput}
                            disabled={isLoading}
                            className="flex flex-col justify-center items-center w-full aspect-square bg-gray-950 border-2 border-dashed border-gray-800 rounded-lg text-gray-600 hover:border-gray-600 hover:text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <span className="mt-2 font-semibold">{t('addImage')}</span>
                        </button>
                    )}
                </div>
                 {multiImageInputs.length > 0 && (
                    <div>
                      <div className="flex justify-center pt-4">
                          <button 
                            onClick={handleAnalyzeComposition} 
                            disabled={isLoading} 
                            className="btn-bubbled disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t('refineAttributes')}
                          </button>
                      </div>

                      {/* Show analyzing indicator under the multi-image inputs while analyzing composition */}
                      {isLoading && appStep === 'analyzingComposition' && (
                        <div className="w-full flex justify-center mt-4">
                          <div className="text-sm text-gray-300 flex items-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                            <span>{t('loaderAnalyzingComposition')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                 )}
              </div>
            )}
          </div>
        
          {appStep === 'choosePath' && inputMode === 'single' && (
      <InspirationStep 
        onAnalyze={handleStartAnalysis}
        disabled={isLoading}
      />
          )}


          {appStep === 'showingInspiration' && uploadedImage && inspirationImages && (
            <InspirationGallery 
                originalImage={{ uri: uploadedImage.dataUrl, title: t('yourOriginalImage'), source: uploadedImage.dataUrl }}
                inspirationImages={inspirationImages}
                onSelect={handleInspirationSelect}
                isLoading={isLoading}
            />
          )}

          {showSelectors && detectedAttributes && (
            <div className="fade-in-up space-y-8">
               {appStep === 'analyzed' && inspirationImages !== null && (
                <div className="w-full mx-auto -mb-6">
                  <button
                    onClick={handleGoBackToInspirations}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-gray-400 hover:text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('backToInspirations')}
                  </button>
                </div>
              )}
              <AttributeSelectors 
                  attributes={detectedAttributes} 
                  onChange={handleAttributeChange}
                  disabled={isLoading}
                />
                {/* Label between attributes and model choices */}
                <div className="mt-4 mb-2 text-center">
                  <span className="text-base font-medium text-gray-300">Prompt for</span>
                </div>
            </div>
          )}

          {/* Keep model selection and generate button visible even if detectedAttributes becomes null */}
          {showGenerateButton && (
            <div className="flex flex-col items-center">
              <div className="flex gap-3 mb-4 items-center justify-center">
                {(['chatgpt','qwen','imagine4','flux','sdxl'] as const).map(key => {
                  const label = key === 'chatgpt' ? 'ChatGPT' : key === 'qwen' ? 'Qwen Image' : key === 'imagine4' ? 'Imagine 4' : key === 'flux' ? 'Flux' : 'SDXL';
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedModelKey(key)}
                      className={`model-bubble ${selectedModelKey === key ? 'active' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="w-full flex justify-center">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={isLoading}
                  className={`generate-bubble ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? t('generatingPrompt') : t('generatePrompt')}
                </button>
              </div>
              {isLoading && <Loader message={loadingMessage} onStop={handleStopGeneration} />}
            </div>
          )}
          
          {error && (
            <div className="max-w-3xl mx-auto bg-black border border-gray-700 text-gray-300 px-4 py-3 rounded-lg text-center">
              <span className="font-bold text-white">{t('errorPrefix')}</span> {error}
            </div>
          )}

      {activeTab === 'input' && appStep === 'showingPrompt' && generatedPrompt && (
              <div className="space-y-8">
                {/* Re-prompt instruction box */}
                <div className="max-w-4xl mx-auto">
                  <textarea
                    value={rePromptInstruction}
                    onChange={(e) => setRePromptInstruction(e.target.value)}
                    placeholder={t('rePromptPlaceholder')}
                    className="w-full bg-gray-900 text-gray-200 placeholder-gray-500 px-4 py-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 mb-4"
                    rows={3}
                    aria-label={t('rePromptPlaceholder')}
                    disabled={isLoading}
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleRegeneratePrompt(rePromptInstruction)}
                      disabled={isLoading || rePromptInstruction.trim() === ''}
                      className={`generate-bubble ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {t('rePromptButton')}
                    </button>
                  </div>
                </div>

                <FinalPromptDisplay
                  prompt={generatedPrompt.artisticPrompt}
                  onRegenerate={handleRegeneratePrompt}
                  disabled={isLoading}
                />
                <JsonPromptDisplay jsonPrompt={generatedPrompt.jsonPrompt} />
              </div>
          )}

        </div>
      </div>
    </div>
  </div>
      </main>
      <footer className="text-center py-6 border-t border-gray-800 mt-12">
        <div className="mb-4">
          <LanguageSelector />
        </div>
        <p className="text-sm text-gray-500">
            <span className="font-bold font-display text-gray-400 text-base">{t('appTitle')}</span>
            <br />
            {t('footerCredit')}
        </p>
        <div className="flex justify-center items-center gap-4 mt-3">
          <a href="https://www.facebook.com/mostafa.mohamed.368765/" target="_blank" rel="noopener noreferrer" aria-label="Mostafa Mohamed Facebook">
            <FacebookIcon className="text-gray-400 hover:text-white" />
          </a>
          <a href="https://www.linkedin.com/in/mostafa-mohamed-b1a464306/" target="_blank" rel="noopener noreferrer" aria-label="Mostafa Mohamed LinkedIn">
            <LinkedInIcon className="text-gray-400 hover:text-white" />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;
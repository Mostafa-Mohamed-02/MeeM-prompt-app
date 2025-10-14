import { DetectedAttributes, FinalPrompt, OllamaConfig, AttributeCategory } from '../types';
import { attributeOptions, normalizeAttributes } from '../types';

type CompositionInput = { base64: string; prompt: string };
type ExtendedCompositionInput = { base64: string; prompt: string; isCropped?: boolean; mask?: { x:number; y:number; width:number; height:number } };

const singleSelectCategories: AttributeCategory[] = ['style', 'projectType', 'openingsRatio', 'color', 'time', 'sky', 'angle', 'aspectRatio'];

const buildAnalysisPrompt = (): string => {
  const singleSelectInstructions = singleSelectCategories
    .map(key => `- ${key} (select only ONE): [${attributeOptions[key].join(', ')}]`)
    .join('\n');

  const multiSelectInstructions = (Object.keys(attributeOptions) as AttributeCategory[])
    .filter(key => !singleSelectCategories.includes(key))
    .map(key => `- ${key} (select one or MORE): [${attributeOptions[key].join(', ')}]`)
    .join('\n');

  return `Analyze the attached architectural exterior image. Follow the instructions for each category carefully.

**Single-Select Categories (Choose only the single most fitting option for each):**
${singleSelectInstructions}

**Multi-Select Categories (Choose one or more fitting options for each):**
${multiSelectInstructions}

Return the results as a single, valid JSON object, where each key holds an array of selected strings. For single-select categories, the array should contain exactly one string. Do not include markdown fences or any other text outside the JSON object.`;
};


const ensureHttpProtocol = (url: string): string => {
  if (!url) return ''; // Handle empty string case
  if (!/^(?:f|ht)tps?:\/\//.test(url)) {
    return `http://${url}`;
  }
  return url;
};

// Cleans the base URL to prevent common user input errors causing 404s.
const cleanBaseUrl = (url: string): string => {
  const withProtocol = ensureHttpProtocol(url);
  // Removes trailing slashes and a potential trailing /api or /api/
  return withProtocol.replace(/\/+$/, '').replace(/\/api\/?$/, '');
};

const handleOllamaError = async (response: Response, modelName: string) => {
    let errorBody;
    try {
        errorBody = await response.json();
        const errorMessage = errorBody.error || `status: ${response.status}`;

        if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('model is missing'))) {
            throw new Error(`Ollama model '${modelName}' not found. Please ensure you have pulled this model (e.g., 'ollama pull ${modelName}').`);
        }
        throw new Error(`Ollama server responded with an error: ${errorMessage}`);

    } catch (e) {
        if (e instanceof Error && e.message.startsWith("Ollama model")) throw e; // re-throw our specific error
        // Response was not JSON, or other parsing error, just throw with status
        throw new Error(`Ollama server responded with status: ${response.status}`);
    }
};

const safeParseModelJson = (text: string, context = ''): any => {
  if (!text || typeof text !== 'string') throw new Error('Empty response from model' + (context ? ` (${context})` : ''));
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    // Attempt to recover by extracting the first JSON object or array in the text
    const objMatch = trimmed.match(/(\{[\s\S]*\})/);
    if (objMatch) {
      try { return JSON.parse(objMatch[1]); } catch (e) { /* fallthrough */ }
    }
    const arrMatch = trimmed.match(/(\[[\s\S]*\])/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[1]); } catch (e) { /* fallthrough */ }
    }

    // As a last resort, try to strip any leading/trailing non-json characters
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      try { return JSON.parse(candidate); } catch (e) { /* fallthrough */ }
    }

    // Throw a detailed error to aid debugging
    const msg = `Failed to parse JSON from model response${context ? ` (${context})` : ''}. Raw response:
${trimmed.slice(0, 1000)}`;
    const error = new Error(msg);
    (error as any).original = err;
    throw error;
  }
};


export const analyzeImageWithOllama = async (
  imageData: string, // base64, no prefix
  config: OllamaConfig,
  signal?: AbortSignal
): Promise<DetectedAttributes> => {
  const promptText = buildAnalysisPrompt();
  
  try {
    const baseUrl = cleanBaseUrl(config.baseUrl);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: promptText,
        images: [imageData],
        format: 'json',
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      await handleOllamaError(response, config.model);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`Ollama API error: ${data.error}`);
    }

    // The response from ollama with format:'json' is a string inside the response key
  const attributes = safeParseModelJson(data.response, 'analyzeImageWithOllama');
    return normalizeAttributes(attributes);

  } catch (error) {
    console.error("Error analyzing image with Ollama:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Connection to Ollama server failed at ${config.baseUrl}. This is often a CORS issue. Ensure the Ollama server is running and configured to accept requests from this origin by setting the OLLAMA_ORIGINS environment variable (e.g., "OLLAMA_ORIGINS='*' ollama serve").`);
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error; // Re-throw abort errors to be handled by the caller
    }
    if (error instanceof Error) {
        throw new Error(`Failed to analyze image with Ollama: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing the image with Ollama.");
  }
};

export const generateFinalPromptWithOllama = async (
  imageData: string,
  attributes: DetectedAttributes,
  config: OllamaConfig,
  signal?: AbortSignal,
  extraInstruction?: string
): Promise<FinalPrompt> => {
  const attributesText = (Object.keys(attributes) as (keyof DetectedAttributes)[])
    .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
    .map(key => `- ${String(key)}: ${attributes[key].join(', ')}`)
    .join('\n');

  let promptText = `Based on the attached image and the following user-defined attributes, generate two things in a single valid JSON object:
    1.  An 'artisticPrompt': A single, highly-detailed, and creative paragraph for an AI image generator. This prompt should follow a formula for high realism: start with the main subject and project type, then IMMEDIATELY state the camera framing and ANGLE (describe the vantage point, lens feel, framing and shot type). After the camera description, describe the architectural style, key features, building materials, glass type, and openings ratio, then detail the surrounding environment including vegetation and sky, describe the lighting, color, and mood, and finish by specifying aspect ratio and suggesting a visual style "in the style of a renowned architectural visualization studio". The camera/angle description should be rich and actionable (e.g., "low-angle 35mm lens, dramatic foreshortening, three-quarter view of the facade"). It should be evocative, using rich architectural and atmospheric language. Do not just list the attributes.
    2.  A 'jsonPrompt': A JSON object that cleanly lists the key attributes. The main subject should be identified from the image and added as a 'subject' key.
    
    Attributes:
    ${attributesText}
    
    Return a single, valid JSON object containing 'artisticPrompt' and 'jsonPrompt' keys, where attribute values in the jsonPrompt are arrays of strings. Do not include markdown fences or any other text.`;
  // Append any model-specific instruction if provided
  if (extraInstruction) {
    promptText = `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}`;
  }
  // If user-provided attributes are present, instruct the model to prioritize them
  if (Object.keys(attributes).length > 0) {
    promptText = `${promptText}\n\nIMPORTANT: The attributes provided by the user are authoritative. Generate the artistic prompt STRICTLY according to these attributes, even if they differ from the original image content.`;
  }
  // Ensure the model prioritizes user-provided attributes if they conflict with the image
  promptText = `${promptText}\n\nIMPORTANT: If any provided attribute conflicts with the visual cues in the image (for example, image appears to be an apartment building but the user-selected projectType is 'skyscraper'), TREAT THE PROVIDED ATTRIBUTES AS AUTHORITATIVE and generate the artistic prompt accordingly. Preserve other image-specific details where possible.`;

  try {
    const baseUrl = cleanBaseUrl(config.baseUrl);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: promptText,
        images: [imageData],
        format: 'json',
        stream: false,
      }),
      signal,
    });
    
    if (!response.ok) {
      await handleOllamaError(response, config.model);
    }

    const data = await response.json();
     if (data.error) {
        throw new Error(`Ollama API error: ${data.error}`);
    }
    
  const finalPrompt = safeParseModelJson(data.response, 'generateFinalPromptWithOllama');
  return finalPrompt as FinalPrompt;

  } catch (error) {
    console.error("Error generating final prompt with Ollama:", error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Connection to Ollama server failed at ${config.baseUrl}. This is often a CORS issue. Ensure the Ollama server is running and configured to accept requests from this origin by setting the OLLAMA_ORIGINS environment variable (e.g., "OLLAMA_ORIGINS='*' ollama serve").`);
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error) {
        throw new Error(`Failed to generate prompt with Ollama: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the final prompt with Ollama.");
  }
};

export const regenerateFinalPromptWithOllama = async (
  editedPrompt: string,
  attributes: DetectedAttributes,
  config: OllamaConfig,
  signal?: AbortSignal,
  extraInstruction?: string
): Promise<FinalPrompt> => {
  const attributesText = (Object.keys(attributes) as (keyof DetectedAttributes)[])
    .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
    .map(key => `- ${String(key)}: ${attributes[key].join(', ')}`)
    .join('\n');

  let promptText = `A user has edited an AI-generated artistic prompt for an architectural design. Your task is to refine and regenerate this prompt based on their edits, while maintaining the core architectural details. Also, update the corresponding JSON object to reflect the changes in the new artistic prompt.

    Original Attributes for Context:
    ${attributesText}

    User's Edited Prompt:
    "${editedPrompt}"

    Now, based on the user's edits, generate a single valid JSON object with two keys:
  1.  'artisticPrompt': A new version of the prompt that incorporates the user's changes, enhances the description, and follows the high-realism formula — placing a clear, detailed camera/angle description immediately after the subject (vantage point, lens/focal feel, framing/shot type), then building out style, materials, environment, lighting, and other details.
    2.  'jsonPrompt': An updated JSON object. The 'subject' and other attributes should be adjusted to perfectly match the content of the newly generated 'artisticPrompt'.

    Return a single, valid JSON object. Do not include markdown fences or any other text.`;

  if (extraInstruction) {
    promptText = `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}`;
  }
  // Prioritize provided attributes over the original generated prompt when regenerating
  promptText = `${promptText}\n\nIMPORTANT: Treat the provided attributes as authoritative. If they conflict with the image or prior prompt, prioritize the attributes when regenerating the artistic prompt.`;

  try {
    const baseUrl = cleanBaseUrl(config.baseUrl);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: promptText,
        // NO images array for text-to-text
        format: 'json',
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      await handleOllamaError(response, config.model);
    }

    const data = await response.json();
     if (data.error) {
        throw new Error(`Ollama API error: ${data.error}`);
    }

  const finalPrompt = safeParseModelJson(data.response, 'regenerateFinalPromptWithOllama');
  return finalPrompt as FinalPrompt;

  } catch (error) {
    console.error("Error regenerating final prompt with Ollama:", error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error) {
        throw new Error(`Failed to regenerate prompt with Ollama: ${error.message}`);
    }
    throw new Error("An unknown error occurred while regenerating the final prompt with Ollama.");
  }
};

export const fetchOllamaModels = async (config: Omit<OllamaConfig, 'model' | 'models'>, signal?: AbortSignal): Promise<string[]> => {
    try {
        const baseUrl = cleanBaseUrl(config.baseUrl);
        const response = await fetch(`${baseUrl}/api/tags`, { signal });
        if (!response.ok) {
            throw new Error(`Ollama server responded with status: ${response.status}. Please check your Server Base URL.`);
        }
        const data = await response.json();
        if (!data.models || !Array.isArray(data.models)) {
             throw new Error('Invalid response from Ollama server when fetching models.');
        }
        // Return the full model name, including the tag (e.g., 'llava:latest')
        const modelNames = data.models.map((m: { name: string }) => m.name);
        return [...new Set<string>(modelNames)];

    } catch (error) {
        console.error("Error fetching Ollama models:", error);
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
           throw new Error(`Connection to Ollama server failed at ${config.baseUrl}. Please ensure it's running and accessible.`);
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        if (error instanceof Error) {
            throw new Error(`Failed to fetch Ollama models: ${error.message}`);
        }
        throw new Error("An unknown error occurred while fetching Ollama models.");
    }
};

const describeImagePartWithOllama = async (
  base64: string,
  prompt: string,
  config: OllamaConfig,
  signal?: AbortSignal
): Promise<string> => {
  let descriptionPrompt = `A user has provided an image and an instruction. Your task is to generate a concise, descriptive text based on that instruction, focusing only on the visual information in the image. Do not add any conversational text, just provide the description.`;
  // Note: Ollama callers may pass a flag in the prompt string indicating cropping; we will not rely on that here.
  descriptionPrompt += `\n\nUser Instruction: "${prompt}"\n\nYour Description:`;
  
  const baseUrl = cleanBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: descriptionPrompt,
      images: [base64],
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    await handleOllamaError(response, config.model);
  }

  const data = await response.json();
  if (data.error) {
      throw new Error(`Ollama API error: ${data.error}`);
  }
  
  return data.response.trim();
};

// Expand a concise description into a full artistic prompt using Ollama
const expandDescriptionToArtisticPromptWithOllama = async (
  description: string,
  config: OllamaConfig,
  signal?: AbortSignal
): Promise<string> => {
  const instruction = `Convert the following concise architectural description into a single, highly-detailed artistic prompt suitable for an AI image generator. Follow a high-realism formula: subject, style, features, materials, environment, lighting, and camera details.`;
  const baseUrl = cleanBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt: `${instruction}\n\nDescription: ${description}\n\nArtistic Prompt:` }),
    signal,
  });
  if (!response.ok) {
    await handleOllamaError(response, config.model);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Ollama API error: ${data.error}`);
  return data.response.trim();
};

// Merge per-part artistic prompts into a single cohesive prompt using Ollama
export const generateMergedArtisticPromptFromPartsWithOllama = async (
  inputs: ExtendedCompositionInput[],
  config: OllamaConfig,
  signal?: AbortSignal
): Promise<string> => {
  // Step 1: Describe each part
  const partDescriptions = await Promise.all(
    inputs.map(i => describeImagePartWithOllama(i.base64, i.prompt, config, signal))
  );

  // Step 2: Expand each description into an artistic prompt
  const perPartPrompts = await Promise.all(
    partDescriptions.map(d => expandDescriptionToArtisticPromptWithOllama(d, config, signal))
  );

  const combinedPerPart = perPartPrompts.map((p, i) => `Part ${i + 1} prompt: ${p}`).join('\n\n');

  const mergeInstruction = `You are an expert architectural prompt writer. Merge the following per-part artistic prompts into one cohesive, highly-detailed artistic prompt for an AI image generator that includes elements from each part.`;

  const baseUrl = cleanBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt: `${mergeInstruction}\n\n${combinedPerPart}\n\nFinal Artistic Prompt:` }),
    signal,
  });

  if (!response.ok) {
    await handleOllamaError(response, config.model);
  }

  const data = await response.json();
  if (data.error) throw new Error(`Ollama API error: ${data.error}`);
  return data.response.trim();
};

export const analyzeCompositionForAttributesWithOllama = async (
  inputs: CompositionInput[],
  config: OllamaConfig,
  signal?: AbortSignal
): Promise<DetectedAttributes> => {
  try {
    // Step 1: Describe each part individually
    const partDescriptions = await Promise.all(
      inputs.map(input => describeImagePartWithOllama(input.base64, input.prompt, config, signal))
    );

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    // Step 2: Combine descriptions and ask for analysis
    const combinedDescriptions = partDescriptions.map((desc, index) => `Part ${index + 1}: ${desc}`).join('\n\n');

    const promptText = `You are an AI assistant for architects. A composite scene has been described by combining several elements. Your task is to analyze the described scene **as a whole** and identify its attributes.

Here are the descriptions of the parts that make up the scene:
${combinedDescriptions}

Now, based on that complete, synthesized scene, provide your analysis by identifying its attributes based on the following categories and options.
    
${buildAnalysisPrompt()}`;

    const baseUrl = cleanBaseUrl(config.baseUrl);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: promptText,
        format: 'json',
        stream: false,
      }),
      signal,
    });
    if (!response.ok) {
        await handleOllamaError(response, config.model);
    }
    const data = await response.json();
    if (data.error) throw new Error(`Ollama API error: ${data.error}`);
  const attributes = safeParseModelJson(data.response, 'analyzeCompositionForAttributesWithOllama');
  return normalizeAttributes(attributes);
  } catch (error) {
    console.error("Error analyzing composition with Ollama:", error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error) {
      throw new Error(`Failed to analyze composition with Ollama: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing composition with Ollama.");
  }
};


export const generateFinalPromptFromAttributesWithOllama = async (
  attributes: DetectedAttributes,
  config: OllamaConfig,
  signal?: AbortSignal,
  extraInstruction?: string
): Promise<FinalPrompt> => {
  const attributesText = (Object.keys(attributes) as (keyof DetectedAttributes)[])
    .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
    .map(key => `- ${String(key)}: ${attributes[key].join(', ')}`)
    .join('\n');

  let promptText = `Based on the following user-defined attributes that describe a synthesized architectural concept, generate two things in a single valid JSON object:
    1.  An 'artisticPrompt': A detailed, creative paragraph for an AI image generator following a high-realism formula, based STRICTLY on the attributes.
    2.  A 'jsonPrompt': A JSON object listing the attributes, including an invented 'subject' that reflects the attributes.
    
    Attributes:
    ${attributesText}
    
    Return a single, valid JSON object. Do not include markdown fences.`;

  if (extraInstruction) {
    promptText = `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}`;
  }

  try {
    const baseUrl = cleanBaseUrl(config.baseUrl);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: promptText,
        format: 'json',
        stream: false,
      }),
      signal,
    });
    if (!response.ok) {
      await handleOllamaError(response, config.model);
    }
    const data = await response.json();
    if (data.error) throw new Error(`Ollama API error: ${data.error}`);
  return safeParseModelJson(data.response, 'generateFinalPromptFromAttributesWithOllama') as FinalPrompt;
  } catch (error) {
    console.error("Error generating prompt from attributes with Ollama:", error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
     if (error instanceof Error) {
      throw new Error(`Failed to generate prompt from attributes with Ollama: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating prompt from attributes with Ollama.");
  }
};
import { GoogleGenAI, Type } from "@google/genai";
import { DetectedAttributes, AttributeCategory, FinalPrompt, WebInspiration } from '../types';
import { attributeOptions, normalizeAttributes } from '../types';

let genAI: GoogleGenAI;

export const initializeGeminiAPI = (apiKey: string) => {
  genAI = new GoogleGenAI({ apiKey });
  return genAI;
};

// Ensure genAI is initialized
const getAI = () => {
  if (!genAI) {
    throw new Error("Gemini API not initialized. Add gemini API key in AI model configuration panel");
  }
  return genAI;
};

const singleSelectCategories: AttributeCategory[] = ['style', 'projectType', 'openingsRatio', 'color', 'time', 'sky', 'angle', 'aspectRatio'];

// Preferred source hosts for higher trust
const preferredHosts = ['dezeen.com', 'archdaily.com', 'unsplash.com', 'pexels.com', 'architizer.com'];

const isLikelyImageUrl = (u: string | undefined) => !!u && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);

// Try to verify a URL is reachable and return metadata. Best-effort — CORS may prevent HEAD requests.
const checkUrlAlive = async (url: string, timeoutMs = 3000): Promise<{ alive: boolean; contentType?: string | null }> => {
  if (!url) return { alive: false };
  // quick heuristic: if URL contains 404-ish keywords, bail out
  if (/404|notfound|error|page-not-found/i.test(url)) return { alive: false };
  // If a local verify server is present, ask it to check the URL (avoids CORS).
  try {
    const verifyServer = process.env.VERIFY_SERVER_URL || 'http://localhost:4001/verify';
    const encoded = `${verifyServer}?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(encoded, { method: 'GET', signal: controller.signal });
    clearTimeout(id);
    if (res && res.ok) {
      const json = await res.json();
      if (json && typeof json.alive !== 'undefined') return { alive: !!json.alive, contentType: json.contentType || null };
    }
  } catch (e) {
    // ignore and fallback to client-side HEAD check
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    if (!res) return { alive: false };
    const contentType = res.headers.get('content-type') || null;
    if (res.ok) return { alive: true, contentType };
    return { alive: false, contentType };
  } catch (e) {
    // If CORS or abort prevented verification, fallback to heuristic by extension
    return { alive: isLikelyImageUrl(url), contentType: undefined };
  }
};

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

Return the results as a JSON object, where each key holds an array of selected strings. For single-select categories, the array should contain exactly one string.`;
};


const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export const findWebInspiration = async (
  imageData: string,
  imageMimeType: string,
  geminiModel: string,
  count: number,
): Promise<WebInspiration[]> => {
  try {
    // First check if the API is initialized
    const api = getAI();
    if (!api) {
      throw new Error("Gemini API not initialized. Add gemini API key in AI model configuration panel");
    }
    
    // Step 1: Analyze the image to get a textual description. This avoids sending
    // a multimodal request with a tool, which can be unstable.
    const imagePart = fileToGenerativePart(imageData, imageMimeType);
    // Build a concise, image-focused search query derived from the input image
    const descriptionPrompt = `From the attached image, analyze it and produce three outputs (each on its own line):
1) A concise 6-12 word search query optimized for finding visually similar architectural exterior photos. Prioritize the building type, dominant materials, and style.
2) A short list of 3 search modifiers (comma-separated) to prioritize high-quality matching image results (e.g., 'site:dezeen.com', 'high-resolution', 'architectural photography').
3) A compact comma-separated tag list focused on STYLE, MATERIALS, and BUILDING_TYPE (e.g., "brutalist, concrete, apartment building").

Return exactly three lines: the search query, the modifiers, and the tag list.`;

    const descriptionResult = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [imagePart, { text: descriptionPrompt }] },
    });

    const descText = descriptionResult.text?.trim() || '';
    // Expect three lines: query, modifiers, tags
    const lines = descText.split('\n').map(l => l.trim()).filter(Boolean);
    const searchQuery = lines[0] || descText;
    const modifiersLine = lines[1] || '';
    const tagsLine = lines[2] || '';
  const extraTags = ['modern', 'minimalist', 'concrete', 'residential', 'exterior', 'facade', 'architecture', 'high-resolution', 'real photo'];
  const modifiers = modifiersLine ? modifiersLine.split(',').map(s => s.trim()).filter(Boolean) : ['site:dezeen.com', 'site:archdaily.com', 'architectural photography'];
  extraTags.forEach(tag => { if (!modifiers.includes(tag)) modifiers.push(tag); });
    const attributeTags = tagsLine ? tagsLine.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Try Pexels first when an API key is available (env var or localStorage). This prefers direct
    // high-quality photography results from pexels.com and avoids unrelated document links.
    const getPexelsKey = () => {
      // Prefer a server/env variable when available
      try {
        if (typeof process !== 'undefined' && process.env && process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
      } catch (e) {}
      // Fallback to localStorage for client-side usage (do NOT commit API keys to repo)
      try {
        if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem('PEXELS_API_KEY') || window.localStorage.getItem('pexels_api_key');
      } catch (e) {}
      return null;
    };

    const pexelsKey = getPexelsKey();
    const searchPexels = async (query: string, perPage = count) : Promise<WebInspiration[] | null> => {
      if (!pexelsKey) return null;
      try {
        const q = encodeURIComponent(query);
        const url = `https://api.pexels.com/v1/search?query=${q}&per_page=${perPage}&orientation=landscape`;
        const res = await fetch(url, { headers: { Authorization: pexelsKey } });
        if (!res.ok) return null;
        const json = await res.json();
        if (!json || !Array.isArray(json.photos)) return null;
        const photos = json.photos as any[];
        const mapped: WebInspiration[] = photos.map(p => ({
          uri: p.url || p.photographer_url || '',
          title: p.alt || (`Pexels - ${p.photographer || 'photo'}`),
          source: 'pexels.com',
          previewUrl: (p.src && (p.src.large || p.src.medium || p.src.original)) || ''
        })).filter(p => p.previewUrl && p.uri);
        if (mapped.length === 0) return null;
        return mapped.slice(0, perPage);
      } catch (e) {
        console.warn('Pexels search failed or was blocked by CORS:', e);
        return null;
      }
    };

    if (pexelsKey) {
      // Build a Pexels-friendly query: include main searchQuery plus attribute tags for focus
      const pexQuery = `${searchQuery} ${attributeTags.join(' ')}`.trim();
      const pexResults = await searchPexels(pexQuery, count);
      if (pexResults && pexResults.length >= Math.min(1, count)) {
        // return pexels results when available (they are direct image hosts and reliable)
        return pexResults.slice(0, count);
      }
    }

    // Step 2: Use the generated query and modifiers to perform the web search with grounding
    // We explicitly request image-focused results and prefer the modifier sites for high-quality content.
  // Include the image-derived tags (style/materials/building type) to bias search results toward visually similar examples.
  const searchPrompt = `Perform a web search to find ${count} high-quality architectural exterior photos that match this query: "${searchQuery}".
Use these modifiers to prioritize results: ${modifiers.join(', ')}.
Additionally, prioritize pages and images that match these tags (STYLE / MATERIALS / BUILDING_TYPE): ${attributeTags.join(', ')}.

Constraints (must follow):
- Prefer direct image URLs (JPEG/PNG) that clearly depict the building exterior.
- Prefer images that match the dominant MATERIALS and STYLE tags exactly (e.g., concrete brutalist, glass curtain wall modernist).
- Prefer results from architecture/image-focused sources (dezeen.com, archdaily.com, unsplash.com, pexels.com, architizer.com) but include others if they have high-resolution images.
- Prefer images with a similar perspective (low-angle, eye-level, aerial) and aspect ratio to the input when possible.

Return concise data for each result: page URL, page title, canonical image URL (if available) and one short reason why this image is a good visual match (1-2 words). Return results as plain text that includes grounding metadata when available.`;

  // Log the generated search pieces so the developer can fine-tune queries in the browser console.
    try { 
      console.info('[findWebInspiration] searchQuery:', searchQuery, 'modifiers:', modifiers, 'tags:', attributeTags);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('lastInspirationSearch', JSON.stringify({ searchQuery, modifiers, attributeTags }));
      }
    } catch {}

    const searchResult = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [{ text: searchPrompt }] },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = searchResult.candidates?.[0]?.groundingMetadata;

    // If grounding metadata is available, parse grounding chunks (preferred, live search)
    if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
      // Build candidate list
      const rawCandidates: any[] = groundingMetadata.groundingChunks
        .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
        .map((chunk: any) => {
          const domain = (() => { try { return new URL(chunk.web.uri).hostname; } catch { return chunk.web.uri; } })();
          const possibleImage = chunk.web.image || chunk.web.imageUrl || chunk.web.ogImage || null;
          const previewUrl = possibleImage ? possibleImage : (process.env.APIFLASH_KEY ? `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(chunk.web.uri)}&format=jpeg&quality=80&thumbnail_width=800` : `https://i.microlink.io/${chunk.web.uri}`);
          return { uri: chunk.web.uri, title: chunk.web.title, source: domain, previewUrl, matchReason: chunk.web.matchReason || '' };
        });

      // Validate and score candidates
      const tagMatchers = attributeTags.map((t: string) => t.toLowerCase());
      const validated = await Promise.all(rawCandidates.map(async (item) => {
        let imageUrl = item.previewUrl;
        const firstCheck = await checkUrlAlive(imageUrl);
        let alive = !!firstCheck.alive;
        let contentType = firstCheck.contentType;
        if (!alive && item.uri) {
          const pageCheck = await checkUrlAlive(item.uri);
          alive = !!pageCheck.alive;
          contentType = contentType || pageCheck.contentType;
        }
        if (!alive && item.uri && process.env.APIFLASH_KEY) {
          const snap = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(item.uri)}&format=jpeg&quality=80&thumbnail_width=800`;
          const snapCheck = await checkUrlAlive(snap);
          if (snapCheck.alive) { imageUrl = snap; alive = true; contentType = snapCheck.contentType || contentType; }
        }

  let score = 0;
  const hay = `${item.title} ${item.uri} ${item.previewUrl} ${item.matchReason}`.toLowerCase();
        tagMatchers.forEach(tag => { if (!tag) return; if (hay.includes(tag)) score += 2; const parts = tag.split(' '); parts.forEach(p => { if (p && hay.includes(p)) score += 0.5; }); });
  if (isLikelyImageUrl(imageUrl)) score += 1.2;
  // boost if content-type is an image
  if (contentType && /image\//i.test(contentType)) score += 1.5;
        try { const host = new URL(item.uri).hostname; if (preferredHosts.some(h => host.includes(h))) score += 1.5; } catch {}
  if (alive) score += 2;
  // reject PDFs and obvious document types
  const isPdf = contentType && /pdf/i.test(contentType);
  if (isPdf) alive = false;
  return { ...item, previewUrl: imageUrl, _score: score, _alive: alive, _contentType: contentType };
      }));

      const filtered = validated.filter(i => {
        const isImageType = i._contentType && /image\//i.test(i._contentType);
        const hostPreferred = (() => { try { return preferredHosts.some(h => i.uri.includes(h)); } catch { return false; } })();
        // Accept if alive and an image, or if the model scored it strongly (>=2), or if it's from a preferred host and alive
        return ((i._alive && isImageType) || (i._score >= 2) || (hostPreferred && i._alive));
      }).sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      return (filtered.slice(0, count) as any[]).map(({ _score, _alive, _contentType, ...rest }) => rest);
    }

    // Fallback: If grounding metadata is missing (some models or responses won't include it),
    // ask the model for a JSON list of candidate pages and image URLs. This isn't a live web
    // crawl but often returns good candidate pages from the model's knowledge and the query.
    console.warn("No grounding chunks found in Gemini response; using fallback text-based search.");

  const fallbackPrompt = `Using the following search query, modifiers, and visual tags (style/materials/building type), return a JSON array of up to ${count} objects with keys {"url","title","imageUrl","source","matchReason"}.
Search query: "${searchQuery}"
Modifiers: ${modifiers.join(', ')}
Visual tags: ${attributeTags.join(', ')}

Requirements:
- imageUrl should be a direct image link (jpeg/png) when possible.
- matchReason should be 1-3 words explaining the match (e.g., "concrete brutalist", "low-angle glass facade").

Prefer pages from architecture-focused sites (dezeen.com, archdaily.com, unsplash.com, pexels.com, architizer.com) and include direct image URLs when possible. Return only valid JSON.`;

    try {
      const fallbackResult = await getAI().models.generateContent({
        model: geminiModel,
        contents: { parts: [{ text: fallbackPrompt }] },
      });

      const text = fallbackResult.text?.trim() || '';
      // Try to parse JSON from the model output. The model may wrap it in backticks or code fences.
      const jsonTextMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      const jsonText = jsonTextMatch ? jsonTextMatch[0] : text;

      let parsed: any = [];
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn('Fallback search JSON parse failed, attempting line-based URL extraction');
        // As a last resort, extract URLs and titles with a simple regex
        const urlRegex = /(https?:\/\/[^\s,]+)/g;
        const urls = Array.from(new Set((text.match(urlRegex) || []).slice(0, count)));
        parsed = urls.map((u: string, i: number) => ({ url: u, title: `Result ${i + 1}`, imageUrl: u, source: (() => { try { return new URL(u).hostname; } catch { return u; } })() }));
      }

      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      let inspirations: any[] = (parsed as any[]).map(item => ({
        uri: item.url || item.uri || item.page || item.pageUrl || '',
        title: item.title || item.name || item.pageTitle || 'Inspiration',
        source: item.source || (() => { try { return new URL(item.url || item.uri).hostname; } catch { return 'unknown'; } })(),
        previewUrl: item.imageUrl || item.img || item.image || item.thumbnail || (item.url ? `https://i.microlink.io/${item.url}` : ''),
        matchReason: item.matchReason || item.match || ''
      })).filter(i => i.uri);

      // Score and prioritize results that match attribute tags (style/materials/building-type)
      const tagMatchers = attributeTags.map(t => t.toLowerCase());
      const scoreFor = (item: any) => {
        let score = 0;
        const hay = `${item.title} ${item.uri} ${item.previewUrl} ${item.matchReason}`.toLowerCase();
        tagMatchers.forEach(tag => { if (!tag) return; if (hay.includes(tag)) score += 2; const parts = tag.split(' '); parts.forEach(p => { if (p && hay.includes(p)) score += 0.6; }); });
        if (item.previewUrl && /\.(jpe?g|png|webp)(\?|$)/i.test(item.previewUrl)) score += 1;
        try { const host = new URL(item.uri).hostname; if (preferredHosts.some(h => host.includes(h))) score += 1.5; } catch {}
        return score;
      };

      inspirations = inspirations.map(i => ({ ...i, _score: scoreFor(i) }));
      inspirations.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));

      // Ensure we provide up to count results. If fewer than count, attempt to pull more URLs from the text
      if (inspirations.length < count) {
        const urlRegex = /(https?:\/\/[^\s,\]\)]+)/g;
        const extraUrls = Array.from(new Set(((text || '').match(urlRegex) || []).slice(0, count * 3))).filter(Boolean);
        extraUrls.forEach((u: string) => {
          if (inspirations.length >= count) return;
          if (inspirations.find((x: any) => x.uri === u)) return;
          inspirations.push({ uri: u, title: u, source: (() => { try { return new URL(u).hostname; } catch { return u; } })(), previewUrl: u, matchReason: '', _score: 0 });
        });
      }

      // Validate final list (HEAD checks) and prefer reachable items
      const validated = await Promise.all(inspirations.map(async (item) => {
        let imageUrl = item.previewUrl;
        const firstCheck = await checkUrlAlive(imageUrl);
        let alive = !!firstCheck.alive;
        let contentType = firstCheck.contentType;
        if (!alive && item.uri) {
          const pageCheck = await checkUrlAlive(item.uri);
          alive = !!pageCheck.alive;
          contentType = contentType || pageCheck.contentType;
        }
        if (!alive && item.uri && process.env.APIFLASH_KEY) {
          const snap = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(item.uri)}&format=jpeg&quality=80&thumbnail_width=800`;
          const snapCheck = await checkUrlAlive(snap);
          if (snapCheck.alive) { imageUrl = snap; alive = true; contentType = snapCheck.contentType || contentType; }
        }
        let score = item._score || 0;
        if (isLikelyImageUrl(imageUrl)) score += 1.2;
        if (contentType && /image\//i.test(contentType)) score += 1.5;
        if (alive) score += 2;
        // filter PDFs
        const isPdf = contentType && /pdf/i.test(contentType);
        if (isPdf) alive = false;
  return { ...item, previewUrl: imageUrl, _score: score, _alive: alive, _contentType: contentType };
      }));

      const filtered = validated.filter(i => {
        const isImageType = i._contentType && /image\//i.test(i._contentType);
        const hostPreferred = (() => { try { return preferredHosts.some(h => i.uri.includes(h)); } catch { return false; } })();
        return ((i._alive && isImageType) || (i._score >= 2) || (hostPreferred && i._alive));
      }).sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      return (filtered.slice(0, count) as any[]).map(({ _score, _alive, _contentType, ...rest }) => rest);
    } catch (fallbackErr) {
      console.error('Fallback search failed:', fallbackErr);
      return [];
    }

  } catch (error) {
    console.error("Error finding web inspiration with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to find inspiration: ${error.message}`);
    }
    throw new Error("An unknown error occurred while finding inspiration.");
  }
};

export const generateInspirationsWithGemini = async (
  imageData: string,
  imageMimeType: string,
  geminiModel: string,
  count: number,
): Promise<WebInspiration[]> => {
  try {
    // Step 1: Generate a rich text prompt from the input image.
    const imagePart = fileToGenerativePart(imageData, imageMimeType);
    const descriptionPrompt = "Describe the architecture in the image in a very detailed, single-paragraph prompt for an AI image generator. Focus on style, materials, form, lighting, and environment to inspire new, creative variations of the building shown.";
    
    const descriptionResult = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [imagePart, { text: descriptionPrompt }] },
    });
    
    const artisticPrompt = descriptionResult.text;
    if (!artisticPrompt) {
      throw new Error("Could not generate a descriptive prompt from the image.");
    }
    
    // Step 2: Use the generated prompt to create new images.
    const imageGenerationResult = await getAI().models.generateImages({
      model: 'imaginify-beta',
      prompt: String(prompt),
    });

    if (!imageGenerationResult.generatedImages || imageGenerationResult.generatedImages.length === 0) {
      throw new Error("Image generation failed to produce results.");
    }
    
    const inspirations: WebInspiration[] = imageGenerationResult.generatedImages.map((img, index) => ({
      uri: `data:image/jpeg;base64,${img.image.imageBytes}`,
      title: `AI Generated Concept ${index + 1}`,
      source: 'AI Generated',
    }));

    return inspirations;
  } catch (error) {
    console.error("Error generating new inspirations with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate inspirations: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating inspirations.");
  }
};


export const analyzeImageWithGemini = async (
  imageData: string,
  imageMimeType: string,
  geminiModel: string,
): Promise<DetectedAttributes> => {
  try {
    const imagePart = fileToGenerativePart(imageData, imageMimeType);
    
    const promptText = buildAnalysisPrompt();

    const schemaProperties: Record<string, any> = {};
    (Object.keys(attributeOptions) as AttributeCategory[]).forEach(key => {
        schemaProperties[key] = {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            }
        };
    });

    const result = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [imagePart, { text: promptText }] },
      config: {
        systemInstruction: "You are an AI assistant for architects. You will analyze an image and provide its attributes in a valid, non-markdown-formatted JSON. You must follow the single-select and multi-select instructions for each attribute category.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: Object.keys(attributeOptions)
        },
      },
    });

    const jsonResponse = JSON.parse(result.text);
    return normalizeAttributes(jsonResponse);

  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing the image.");
  }
};


export const generateFinalPromptWithGemini = async (
  imageData: string,
  imageMimeType: string,
  attributes: DetectedAttributes,
  geminiModel: string,
  extraInstruction?: string,
): Promise<FinalPrompt> => {
   try {
    const imagePart = fileToGenerativePart(imageData, imageMimeType);
    const attributesText = (Object.keys(attributes) as AttributeCategory[])
      .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
      .map(key => `- ${key}: ${attributes[key].join(', ')}`)
      .join('\n');

  const promptText = `Based on the attached image and the following user-defined attributes, generate two things:
    1.  An 'artisticPrompt': A single, highly-detailed, and creative paragraph for an AI image generator. This prompt should follow a formula for high realism: start with the main subject and project type, then IMMEDIATELY describe the CAMERA framing and ANGLE (vantage, lens/focal feel, and shot type). After the camera/angle description, detail the architectural style, key features, building materials, glass type, and openings ratio, then the surrounding environment including vegetation and sky, and the lighting, color, and mood. Finish with aspect ratio and a suggested visual style "in the style of a renowned architectural visualization studio". The camera/angle should be actionable (e.g., "low-angle, 35mm-equivalent, dramatic foreshortening, three-quarter facade view"). It should be evocative and not just a list.
    2.  A 'jsonPrompt': A JSON object that cleanly lists the key attributes. The main subject should be identified from the image and added as a 'subject' key. The attributes should be arrays of strings.
    
    Attributes:
    ${attributesText}`;
  // Append any extra model-specific instruction to guide the final prompt style/structure
  const finalPromptText = extraInstruction ? `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}` : promptText;

    const jsonPromptSchemaProperties: Record<string, any> = { subject: { type: Type.STRING } };
     (Object.keys(attributeOptions) as AttributeCategory[]).forEach(key => {
        jsonPromptSchemaProperties[key] = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };
    });


    // Add a system-level instruction to prefer the provided attributes if they conflict
    // with the image content. The user may have edited an attribute to override the image.
    const augmentedFinalPromptText = `${finalPromptText}\n\nIMPORTANT: If any of the provided attributes conflict with the visual content of the attached image (for example, the image looks like an apartment building but the user-selected projectType is 'skyscraper'), PRIORITIZE the user-provided attributes. Generate the artistic prompt describing the scene according to the attributes while preserving other context from the image where possible.`;

    const result = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [imagePart, { text: augmentedFinalPromptText }] },
      config: {
        systemInstruction: "You are an AI assistant for architects. The user may provide attributes that override the image; in such a case, follow the attributes as authoritative. Based on an image and refined attributes, generate a detailed artistic prompt and a corresponding JSON object for use with AI image generators. Always return valid, non-markdown-formatted JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artisticPrompt: { 
              type: Type.STRING,
              description: "A detailed, descriptive paragraph for an AI image generator, formatted for high realism."
            },
            jsonPrompt: {
              type: Type.OBJECT,
              properties: jsonPromptSchemaProperties,
              required: ['subject', ...Object.keys(attributeOptions)]
            }
          },
          required: ['artisticPrompt', 'jsonPrompt']
        }
      }
    });
    
    const jsonResponse = JSON.parse(result.text);
    return jsonResponse as FinalPrompt;

  } catch (error) {
    console.error("Error generating final prompt with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the final prompt.");
  }
};

export const regenerateFinalPromptWithGemini = async (
  editedPrompt: string,
  attributes: DetectedAttributes,
  geminiModel: string,
  extraInstruction?: string,
): Promise<FinalPrompt> => {
   try {
    const attributesText = (Object.keys(attributes) as AttributeCategory[])
      .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
      .map(key => `- ${key}: ${attributes[key].join(', ')}`)
      .join('\n');

  const promptText = `A user has edited an AI-generated artistic prompt for an architectural design. Your task is to refine and regenerate this prompt based on their edits, while maintaining the core architectural details. Also, update the corresponding JSON object to reflect the changes in the new artistic prompt.

    Original Attributes for Context:
    ${attributesText}

    User's Edited Prompt:
    "${editedPrompt}"

    Now, based on the user's edits, generate two things:
    1.  An 'artisticPrompt': A new version of the prompt that incorporates the user's changes, enhances the description, and follows the high-realism formula (subject, style, materials, environment, lighting, camera, etc.).
    2.  A 'jsonPrompt': An updated JSON object. The 'subject' and other attributes should be adjusted to perfectly match the content of the newly generated 'artisticPrompt'.`;

    const jsonPromptSchemaProperties: Record<string, any> = { subject: { type: Type.STRING } };
     (Object.keys(attributeOptions) as AttributeCategory[]).forEach(key => {
        jsonPromptSchemaProperties[key] = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };
    });

    const finalEditedPromptText = extraInstruction ? `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}` : promptText;

    // If the user edited the prompt and also provided attributes, instruct the model to
    // prioritize attributes as authoritative when regenerating.
    const augmentedFinalEditedPromptText = `${finalEditedPromptText}\n\nIMPORTANT: Treat the provided attributes as authoritative. If they conflict with the original image or earlier prompt, prioritize the attributes when regenerating the artistic prompt.`;

    const result = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [{ text: augmentedFinalEditedPromptText }] }, // Text-only, no image
      config: {
        systemInstruction: "You are an AI assistant for architects. Treat provided attributes as authoritative; when regenerating a prompt from edits, prioritize the attributes if they conflict with any visual cues. Always return valid, non-markdown-formatted JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artisticPrompt: {
              type: Type.STRING,
              description: "A detailed, descriptive paragraph for an AI image generator, formatted for high realism."
            },
            jsonPrompt: {
              type: Type.OBJECT,
              properties: jsonPromptSchemaProperties,
              required: ['subject', ...Object.keys(attributeOptions)]
            }
          },
          required: ['artisticPrompt', 'jsonPrompt']
        }
      }
    });

    const jsonResponse = JSON.parse(result.text);
    return jsonResponse as FinalPrompt;

  } catch (error) {
    console.error("Error regenerating final prompt with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to regenerate prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while regenerating the final prompt.");
  }
};

type CompositionInput = { base64: string; mimeType: string; prompt: string; isCropped?: boolean; mask?: { x:number; y:number; width:number; height:number } };

const describeImagePart = async (
  input: CompositionInput,
  geminiModel: string
): Promise<string> => {
  const { base64, mimeType, prompt, isCropped } = input;
  const imagePart = fileToGenerativePart(base64, mimeType);
  let descriptionPrompt = `You are an architectural AI assistant. A user has provided an image and a specific instruction about what elements they want to extract from this image.`;

  if (isCropped) {
    descriptionPrompt += `\n\nNote: The provided image is a cropped region (the user highlighted this part). Focus ONLY on the visible area and ignore context outside the mask.`;
  }

  descriptionPrompt += `\n\nUser's Specific Request: "${prompt}"\n\nYour task:\n1. Focus ONLY on the elements specifically requested in the user's instruction\n2. Describe those elements in detail, including materials, style, and characteristics\n3. Ignore any aspects of the image not mentioned in the user's request\n4. Be precise and architectural in your description\n\nYour Analysis of Requested Elements:`;

  const result = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: [imagePart, { text: descriptionPrompt }] },
  });
  
  return result.text;
};


export const generateInspirationsFromComposition = async (
  inputs: CompositionInput[],
  geminiModel: string,
  count: number,
): Promise<WebInspiration[]> => {
  try {
    // Step 1: Describe each part individually
    const partDescriptions = await Promise.all(
      inputs.map(input => describeImagePart(input, geminiModel))
    );

    // Step 2: Combine the text descriptions into a final artistic prompt
    const combinedDescriptions = partDescriptions.map((desc, index) => `Part ${index + 1}: ${desc}`).join('\n\n');

    const finalPromptInstruction = `You are an AI architectural assistant tasked with generating a highly detailed architectural prompt. The user has provided multiple images with specific instructions for each one. Your task is to create a unified, cohesive prompt that incorporates all the requested elements from each image while maintaining architectural coherence.

INPUT DESCRIPTIONS:
${combinedDescriptions}

IMPORTANT RULES:
1. Each image's specific requirements MUST be included in the final prompt
2. Focus on the exact elements mentioned in each image's instruction
3. The final prompt must follow this structure:
   - Start with the main subject and project type
   - Describe architectural style and key features
   - Detail the materials and construction elements
   - Describe the environment and surroundings
   - Specify lighting, mood, and atmosphere
   - End with camera and rendering specifications

Generate a detailed architectural prompt that STRICTLY incorporates all the specific elements requested in each image's instruction:

Final Artistic Prompt:`;
    
    const descriptionResult = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [{ text: finalPromptInstruction }] },
    });
    
    const artisticPrompt = descriptionResult.text;
    if (!artisticPrompt) {
      throw new Error("Could not generate a descriptive prompt from the combined descriptions.");
    }

    // Step 3: Generate images from the final prompt
    const imageGenerationResult = await getAI().models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: artisticPrompt,
      config: { numberOfImages: count, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
    });

    if (!imageGenerationResult.generatedImages || imageGenerationResult.generatedImages.length === 0) {
      throw new Error("Image generation failed to produce results from the composition.");
    }

    return imageGenerationResult.generatedImages.map((img, index) => ({
      uri: `data:image/jpeg;base64,${img.image.imageBytes}`,
      title: `AI Generated Composition ${index + 1}`,
      source: 'AI Generated',
    }));
  } catch (error) {
    console.error("Error generating inspirations from composition:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate from composition: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating from composition.");
  }
};

export const analyzeCompositionForAttributes = async (
  inputs: CompositionInput[],
  geminiModel: string
): Promise<DetectedAttributes> => {
  try {
     // Step 1: Describe each part individually
    const partDescriptions = await Promise.all(
      inputs.map(input => describeImagePart(input, geminiModel))
    );

    // Step 2: Combine descriptions and ask for attribute analysis
    const combinedDescriptions = partDescriptions.map((desc, index) => `Part ${index + 1}: ${desc}`).join('\n\n');

    const finalTaskPrompt = `You are an AI assistant for architects. A composite scene has been described by combining several elements. Your task is to analyze the described scene **as a whole** and identify its attributes.

Here are the descriptions of the parts that make up the scene:
${combinedDescriptions}

Now, based on that complete, synthesized scene, provide your analysis by identifying its attributes based on the following categories and options.
    
${buildAnalysisPrompt()}`;

    const schemaProperties: Record<string, any> = {};
    (Object.keys(attributeOptions) as AttributeCategory[]).forEach(key => {
        schemaProperties[key] = { type: Type.ARRAY, items: { type: Type.STRING } };
    });

    const result = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [{ text: finalTaskPrompt }] },
      config: {
        systemInstruction: "You are an AI assistant for architects. You will analyze a textual description of a composite scene to extract its key attributes as a valid, non-markdown-formatted JSON object. You must follow the single-select and multi-select instructions for each attribute category.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: Object.keys(attributeOptions)
        },
      },
    });

    const jsonResponse = JSON.parse(result.text);
    return normalizeAttributes(jsonResponse);
  } catch (error) {
    console.error("Error analyzing composition:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to analyze composition: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing the composition.");
  }
};

// Expand a concise description into a full artistic prompt for an AI image generator
export const expandDescriptionToArtisticPrompt = async (
  description: string,
  geminiModel: string
): Promise<string> => {
  const instruction = `You are an AI assistant for architects. Convert the following concise architectural description into a single, highly-detailed artistic prompt suitable for an AI image generator. Follow a high-realism formula: start with the main subject and project type, then IMMEDIATELY provide a clear camera/angle description (vantage, lens/focal feel, framing/shot type) before expanding into architectural style, key features, materials, environment, lighting, and other details. Produce one evocative paragraph.`;

  const result = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: [{ text: `${instruction}\n\nDescription: ${description}\n\nArtistic Prompt:` }] },
  });

  return result.text;
};

// For a set of image parts (each has a user-specific prompt and an image), describe each part,
// expand each into an artistic prompt, then synthesize them into a single final prompt that
// includes all requested elements.
export const generateMergedArtisticPromptFromParts = async (
  inputs: CompositionInput[],
  geminiModel: string
): Promise<string> => {
  // Step 1: Describe each part according to its specific instruction
    const partDescriptions = await Promise.all(
      inputs.map(input => describeImagePart(input, geminiModel))
    );

  // Step 2: Expand each part description into its own artistic prompt
  const perPartPrompts = await Promise.all(
    partDescriptions.map(desc => expandDescriptionToArtisticPrompt(desc, geminiModel))
  );

  // Step 3: Combine per-part prompts into a single output while ensuring all requested elements
  // are preserved. We ask the model to weave them together rather than list them.
  const combinedPerPart = perPartPrompts.map((p, i) => `Part ${i + 1} prompt: ${p}`).join('\n\n');

  const mergeInstruction = `You are an expert architectural prompt writer. You have several artistic prompts describing separate parts of a single composition. Your task is to weave these into one cohesive, highly-detailed artistic prompt for an AI image generator that STRICTLY includes the requested elements from each part. Do not merely concatenate — integrate them into a natural, unified scene description. Follow this order: subject and project type, architectural style, key features and materials, surroundings and vegetation, lighting and mood, camera and rendering details.`;

  const mergeResult = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: [{ text: `${mergeInstruction}\n\n${combinedPerPart}\n\nFinal Artistic Prompt:` }] },
  });

  return mergeResult.text;
};

export const generateFinalPromptFromAttributes = async (
  attributes: DetectedAttributes,
  geminiModel: string,
  extraInstruction?: string,
): Promise<FinalPrompt> => {
   try {
    const attributesText = (Object.keys(attributes) as AttributeCategory[])
      .filter(key => Array.isArray(attributes[key]) && attributes[key].length > 0)
      .map(key => `- ${key}: ${attributes[key].join(', ')}`)
      .join('\n');

    const promptText = `Based on the following user-defined attributes that describe a synthesized architectural concept, generate two things:
    1.  An 'artisticPrompt': A single, highly-detailed, and creative paragraph for an AI image generator. This prompt should be a cohesive description of a single building concept derived STRICTLY from the attributes provided. Follow a formula for high realism: start with a main subject and project type based on the attributes, describe its architectural style, key features, building materials, glass type, and openings ratio, detail the surrounding environment including vegetation and sky, describe the lighting, color, and mood, specify the camera type, angle, shot type and aspect ratio, and finally suggest a visual style "in the style of a renowned architectural visualization studio".
    2.  A 'jsonPrompt': A JSON object that cleanly lists the key attributes. Invent a plausible 'subject' based on the attributes provided. The attributes should be arrays of strings.
    
    Attributes:
    ${attributesText}`;

    const jsonPromptSchemaProperties: Record<string, any> = { subject: { type: Type.STRING } };
     (Object.keys(attributeOptions) as AttributeCategory[]).forEach(key => {
        jsonPromptSchemaProperties[key] = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };
    });

    const finalPromptText = extraInstruction ? `${promptText}\n\nModel-Specific Instruction: ${extraInstruction}` : promptText;

    const result = await getAI().models.generateContent({
      model: geminiModel,
      contents: { parts: [{ text: finalPromptText }] }, // Text-only request
      config: {
        systemInstruction: "You are an AI assistant for architects. Based on a set of attributes describing a synthesized design, you will generate a detailed artistic prompt and a corresponding JSON object. Adhere strictly to the provided attributes. Always return valid, non-markdown-formatted JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artisticPrompt: { 
              type: Type.STRING,
              description: "A detailed, descriptive paragraph for an AI image generator, formatted for high realism."
            },
            jsonPrompt: {
              type: Type.OBJECT,
              properties: jsonPromptSchemaProperties,
              required: ['subject', ...Object.keys(attributeOptions)]
            }
          },
          required: ['artisticPrompt', 'jsonPrompt']
        }
      }
    });
    
    const jsonResponse = JSON.parse(result.text);
    return jsonResponse as FinalPrompt;

  } catch (error) {
    console.error("Error generating final prompt from attributes:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate prompt from attributes: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the final prompt from attributes.");
  }
};
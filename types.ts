import { RefObject } from 'react';

// ---------- CONFIG & DATA ----------

export const attributeOptions = {
  style: [
    'Modern','Contemporary','Minimalist','Brutalist','Deconstructivist','Postmodern','Industrial','Scandinavian','Mediterranean','Victorian','Art Deco','Gothic','Neoclassical','Organic','Parametric',
    'Acadian architecture','Adam style','Adirondack Architecture','Anglo-Saxon architecture','American colonial architecture','American Craftsman','American Empire','American Foursquare','Amsterdam School','Ancient Egyptian architecture','Ancient Greek architecture','Angevin Gothic','Arcology','Art Deco','Art Nouveau','Australian architectural styles','Baroque architecture','Bauhaus','Beaux-Arts architecture','Berlin style','Biedermeier','Blobitecture','Bowellism','Brick Gothic','Bristol Byzantine','Brownstone','Brutalist architecture','Buddhist architecture','Byzantine architecture','Cape Cod','Carolingian architecture','Carpenter Gothic','Châteauesque','Chicago school','Chilotan architecture','Churrigueresque','City Beautiful movement','Classical architecture','Colonial Revival architecture','Constructivist architecture','Danish Functionalism','Deconstructivism','Decorated Period','Dragestil','Dutch Colonial','Eclectic','Edwardian','Egyptian Revival','Elizabethan','Federal','Folk','French Colonial','Georgian','Gothic architecture','Gothic Revival architecture','Gotico Angioiano','Greek Revival architecture','Green building','Heliopolis style','Indian architecture','International style','Isabelline Gothic','Islamic Architecture','Italianate architecture','Jacobean architecture','Jacobethan','Jeffersonian architecture','Jengki style','Jugendstil','Manueline','Mediterranean Revival Style','Memphis Group','Merovingian architecture','Metabolist Movement','Mid-century modern','Mission Revival Style','Modern movement','Modernisme','National Park Service Rustic','Natural building','Nazi architecture','Neo-Byzantine architecture','Neoclassical architecture','Neo-Grec','Neo-Gothic architecture','Neolithic architecture','Neo-Manueline','New towns','Norman architecture','Organic architecture','Ottonian architecture','Palladian architecture','Perpendicular Period','Plantagenet Style','Ponce Creole','Pombaline style','Postmodern architecture','Polish Cathedral Style','Polite architecture','Prairie Style','Pueblo style','Queen Anne Style','Queenslander','Ranch-style','Repoblación architecture','Regency architecture','Richardsonian Romanesque','Rococo','Roman architecture','Romanesque architecture','Romanesque Revival architecture','Russian architecture','Russian Revival','Saltbox','San Francisco architecture','Scottish Baronial','Second Empire','Serbo-Byzantine revival','Shingle Style','Sicilian Baroque','Soft Portuguese style','Spanish Colonial','Spanish Revival','Tudor','Victorian','Contemporary'
  ],
  angle: ['Eye-level', 'Low-angle', 'High-angle', 'Worm\'s-eye view', 'Bird\'s-eye view', 'Aerial view', 'Street-level', 'Front view', 'Side view', 'Oblique view'],
  lighting: ['Natural light', 'Golden hour', 'Blue hour', 'Overcast', 'Direct sunlight', 'Backlit', 'Artificial lighting', 'Night lighting', 'Dramatic lighting', 'Soft lighting'],
  time: ['Day', 'Night', 'Sunrise', 'Sunset', 'Dusk', 'Dawn', 'Midday'],
  projectType: [
    'Residential Buildings','Single-family houses','Multi-family apartments and condominiums','Townhouses','Villas and mansions','Apartment Building','Skyscraper',
    'Commercial Buildings','Offices','Retail shops and malls','Hotels and resorts','Restaurants and cafes',
    'Industrial Buildings','Factories and manufacturing plants','Warehouses and storage facilities','Workshops',
    'Public and Institutional Buildings','Government buildings','Schools and universities','Hospitals and healthcare facilities','Libraries',
    'Religious Buildings','Churches','Mosques','Temples','Synagogues',
    'Recreational and Cultural Buildings','Theaters and cinemas','Museums and galleries','Sports arenas and stadiums',
    'Transportation Buildings','Airports','Railway stations','Bus terminals','Ports',
    'Agricultural Buildings','Barns','Silos','Agricultural storage',
    'Mixed-use Buildings','Cultural Center','Cabin','Villa','Public Space'
  ],
  buildingMaterials: [
    'Concrete', 'Cement', 'Glass', 'Glass fiber concrete', 'Steel', 'Metal panel', 'Metal cladding', 'Photovoltaic fins', 'Ceramic cladding', 'Stone', 'Stone cladding', 'Granite', 'Outdoor granite', 'Brick', 'Brick veneer cladding', 'Wood', 'TECH-wood', 'HPL', 'Stucco', 'Terracotta', 'Composite materials', 'Carbon fiber', 'Exterior paint', 'Interlock', 'WPS', 'Rubber slate', 'Concrete roof', 'Clay roofs', 'Solar roof tiles', 'Warm pitched roof panels', 'Green roofs'
  ],
  glassType: ['Clear glass', 'Frosted glass', 'Stained glass', 'Smart glass', 'Curved glass', 'Reflective glass', 'Transparent', 'Translucent'],
  openingsRatio: ['Mostly solid', 'Balanced', 'Mostly open', 'Full glass facade', 'Punch windows', 'Ribbon windows'],
  vegetation: ['Lush', 'Sparse', 'None', 'Manicured garden', 'Wild nature', 'Trees', 'Grass', 'Desert plants', 'Green roof'],
  color: ['Monochromatic', 'Vibrant colors', 'Earthy tones', 'Pastel colors', 'Neutral colors', 'Black and white', 'Warm colors', 'Cool colors'],
  sky: ['Clear sky', 'Cloudy', 'Stormy', 'Sunset sky', 'Night sky with stars', 'Overcast grey'],
  aspectRatio: ['16:9', '9:16', '4:3', '3:4', '1:1', '2.35:1'],
  cameraType: ['DSLR', 'Drone', 'Film camera', 'Wide-angle lens', 'Telephoto lens', 'Fisheye lens'],
};

export type AttributeCategory = keyof typeof attributeOptions;

export type DetectedAttributes = {
  [K in AttributeCategory]: string[];
};

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  filePath: string;
  hash?: string;
  dataUrl: string;
  metadata?: {
    attributes?: DetectedAttributes;
    prompt?: string;
  };
}

export interface HistoryState {
  items: HistoryItem[];
  selectedItemId: string | null;
}

export const normalizeAttributes = (data: any): DetectedAttributes => {
  const normalized: Partial<DetectedAttributes> = {};
  const allCategories = Object.keys(attributeOptions) as AttributeCategory[];

  allCategories.forEach(category => {
    const value = data[category];
    const validOptions = attributeOptions[category];

    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      // Filter to ensure only valid options are kept
      normalized[category] = value.filter(v => validOptions.includes(v));
    } else if (typeof value === 'string') {
      // Handle case where AI returns a single string
      if (validOptions.includes(value)) {
        normalized[category] = [value];
      } else {
        normalized[category] = [];
      }
    } else {
      // Default to empty array for invalid or missing data
      normalized[category] = [];
    }
  });

  return normalized as DetectedAttributes;
};


// ---------- API & STATE ----------

export type WebInspiration = {
  uri: string;
  title: string;
  source: string;
  previewUrl?: string;
};

export type FinalPrompt = {
  artisticPrompt: string;
  jsonPrompt: {
    subject: string;
  } & DetectedAttributes;
};

export type ModelProvider = 'gemini' | 'ollama';

export interface GeminiConfig {
  model: string;
  apiKey?: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  models: string[];
}

export interface ModelConfig {
  provider: ModelProvider;
  gemini: GeminiConfig;
  ollama: OllamaConfig;
}

export interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MultiImageInputState {
  id: string;
  dataUrl: string;
  file: File;
  mask: Mask | null;
  // When true the user can draw masks on the image. When false drawing is disabled and any existing mask is ignored.
  maskEnabled: boolean;
  prompt: string;
  imageRef: RefObject<HTMLImageElement>;
}
import React, { useCallback, useState } from 'react';
import { DetectedAttributes, AttributeCategory } from '../types';
import { attributeOptions } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface AttributeSelectorsProps {
  attributes: DetectedAttributes;
  onChange: (newAttributes: DetectedAttributes) => void;
  disabled: boolean;
}

type AttributeGroupKey = 'compositionStyle' | 'materialsForm' | 'environmentAtmosphere' | 'photographyAngle';

const attributeGroups: Record<AttributeGroupKey, AttributeCategory[]> = {
  'compositionStyle': ['style', 'projectType', 'openingsRatio', 'color'],
  'materialsForm': ['buildingMaterials', 'glassType'],
  'environmentAtmosphere': ['lighting', 'time', 'vegetation', 'sky'],
  'photographyAngle': ['angle', 'aspectRatio', 'cameraType'],
};

const AttributeTagSelector: React.FC<{
  category: AttributeCategory;
  selected: string[];
  onChange: (category: AttributeCategory, selected: string[]) => void;
  disabled: boolean;
}> = ({ category, selected, onChange, disabled }) => {
  const { t } = useLocalization();
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const NONE_LABEL = 'None';

  const handleSelect = (option: string) => {
    if (disabled) return;
    const noneLower = NONE_LABEL.toLowerCase();
    const optionLower = option.toLowerCase();

    // If the user clicked the special None option, clear the selection
    if (optionLower === noneLower) {
      onChange(category, []);
      return;
    }

    // Toggle option case-insensitively. Remove any 'None' entries when selecting a normal option.
    const currentlyHas = (selected || []).some(s => s.toLowerCase() === optionLower);
    let newSelected: string[];
    if (currentlyHas) {
      newSelected = (selected || []).filter(s => s.toLowerCase() !== optionLower);
    } else {
      // add option (preserve option's casing)
      newSelected = [ ...(selected || []).filter(s => s.toLowerCase() !== noneLower && s.toLowerCase() !== optionLower), option ];
    }
    // dedupe before emitting (preserve original casing of first occurrence)
    const deduped = Array.from(new Map(newSelected.map(s => [s.toLowerCase(), s])).values());
    onChange(category, deduped);
  };

  const allOptions = attributeOptions[category];
  // Hide any existing 'None' entries from the source options and dedupe case-insensitively
  const displayOptions: string[] = allOptions.filter((opt, i, arr) => {
    const lower = opt.toLowerCase();
    if (lower === NONE_LABEL.toLowerCase()) return false;
    return arr.findIndex(x => x.toLowerCase() === lower) === i;
  });

  // Preview first few options for tooltip (from displayOptions so 'None' isn't repeated)
  const preview = displayOptions.slice(0, 6).join(', ');

  // Treat any stored 'None' in selected as equivalent to no selection and dedupe case-insensitively
  const rawSelected = (selected || []).map(s => String(s));
  const effectiveSelected: string[] = Array.from(new Map(rawSelected
    .filter(s => s && s.toLowerCase() !== NONE_LABEL.toLowerCase())
    .map(s => [s.toLowerCase(), s])
  ).values()) as string[];

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setCollapsed(c => !c);
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-transparent rounded-md hover:bg-gray-900 transition-colors"
        >
          <span className="block text-sm font-medium text-gray-400 group">
            <span className="inline-block" aria-hidden>{t(`attribute_${category}`)}</span>
          </span>
          <svg className={`h-4 w-4 text-gray-400 transform transition-transform ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L10 5.414 5.707 9.707A1 1 0 114.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
          </svg>
        </button>

        {/* tooltip preview on hover */}
        <div className="absolute left-0 mt-1 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="hidden group-hover:block absolute -translate-y-1/2 translate-x-0 bg-gray-800 text-gray-200 text-xs rounded-md px-3 py-2 shadow-lg max-w-xs">
            {preview}
          </div>
        </div>
      </div>

    {/* Show selected chips when collapsed so user can see current selections */}
    {collapsed && effectiveSelected && effectiveSelected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {effectiveSelected.slice(0, 6).map((opt, i) => (
            <button
              key={`${opt}-${i}`}
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={disabled}
              className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white text-black"
              title={opt}
            >
              {opt}
            </button>
          ))}
          {effectiveSelected.length > 6 && (
            <div className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-800 text-gray-300">+{effectiveSelected.length - 6}</div>
          )}
        </div>
      )}

      {/* When collapsed and nothing selected, show explicit (none) chip */}
      {collapsed && effectiveSelected && effectiveSelected.length === 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            disabled={disabled}
            className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-800 text-gray-300"
            title={NONE_LABEL}
          >
            {NONE_LABEL}
          </button>
        </div>
      )}

      {!collapsed && (
        <div>
          <div className="mb-2">
            <div className="relative max-w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search options"
                className="w-full bg-gray-900 text-gray-200 placeholder-gray-500 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              {search.length > 0 && (
                <button
                  onClick={() => setSearch('')}
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white px-2"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
          {/* 'None' option (clears selection). We hide any existing 'None' in the source options above. */}
          <button
            key={NONE_LABEL}
            type="button"
            onClick={() => { if (!disabled) onChange(category, []); }}
            disabled={disabled}
            className={
              `
                px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                ${effectiveSelected.length === 0
                  ? 'bg-white text-black shadow-md'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `
            }
          >
            {NONE_LABEL}
          </button>
          {displayOptions.filter(opt => opt.toLowerCase().includes(search.toLowerCase())).map((option, idx) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={`${option}-${idx}`}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={disabled}
                className={
                  `px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${isSelected ? 'bg-white text-black shadow-md' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`
                }
              >
                {option}
              </button>
            )
          })}
          </div>
        </div>
      )}
    </div>
  );
};


const AttributeSelectors: React.FC<AttributeSelectorsProps> = ({ attributes, onChange, disabled }) => {
  const { t } = useLocalization();

  const handleChange = useCallback((category: AttributeCategory, value: string[]) => {
    onChange({ ...attributes, [category]: value });
  }, [attributes, onChange]);

  return (
  <div className="w-full mx-auto">
       <div className="text-center mb-8">
    <h2 className="text-2xl font-bold text-white font-display tracking-wide">{t('attributesTitle')}</h2>
    <p className="mt-2 text-gray-400 max-w-3xl mx-auto">{t('attributesDescription')}</p>
       </div>
      <div className="space-y-8">
        {(Object.keys(attributeGroups) as AttributeGroupKey[]).map((groupName) => (
          <div key={groupName} className="bg-gray-950 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-200 mb-6">{t(`attributeGroup_${groupName}`)}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                {attributeGroups[groupName].map((category) => (
                  <AttributeTagSelector
                    key={category}
                    category={category}
                    selected={attributes[category] || []}
                    onChange={handleChange}
                    disabled={disabled}
                  />
                ))}
              </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttributeSelectors;
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useRef, useEffect, useState } from 'react';
import { TabbedPane } from '@web/components/tabbedPane';
import './networkFilters.css';

const resourceTypes = ['All', 'Fetch', 'HTML', 'JS', 'CSS', 'Font', 'Image'] as const;
export type ResourceType = typeof resourceTypes[number];

export type FilterState = {
  searchValue: string;
  resourceType: ResourceType;
};

export const defaultFilterState: FilterState = { searchValue: '', resourceType: 'All' };

export const NetworkFilters = ({ filterState, onFilterStateChange }: {
  filterState: FilterState,
  onFilterStateChange: (filterState: FilterState) => void,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resourceTypesContainerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);

  const allResourceTypes = React.useMemo(() => [...resourceTypes], []);
  const [visibleResourceTypes, setVisibleResourceTypes] = useState<ResourceType[]>(allResourceTypes);
  const [overflowResourceTypes, setOverflowResourceTypes] = useState<ResourceType[]>([]);
  const [elementWidths, setElementWidths] = useState<Record<string, number>>({});
  const [tabbedPaneWidth, setTabbedPaneWidth] = useState<number>(80);

  // Constants from CSS
  const CONTAINER_GAP = 0;
  const RESOURCE_TYPE_GAP = 0;

  // Helper to create and measure a DOM element
  const measureElement = (className: string, content: string, minWidth: number): number => {
    if (!measurementRef.current)
      return minWidth;

    const element = document.createElement('div');
    element.className = className;
    element.textContent = content;
    element.style.cssText = 'visibility: hidden; position: absolute; white-space: nowrap;';

    measurementRef.current.appendChild(element);
    const width = Math.max(element.offsetWidth, minWidth);
    measurementRef.current.removeChild(element);

    return width;
  };

  // Measure all element widths
  const measureAllWidths = React.useCallback(() => {
    if (!measurementRef.current)
      return;

    measurementRef.current.innerHTML = '';

    const widths: Record<string, number> = {};
    allResourceTypes.forEach(resourceType => {
      widths[resourceType] = measureElement('network-filters-resource-type', resourceType, 0);
    });

    const measuredTabbedWidth = measureElement('tabbed-pane', '•••', 80);

    setElementWidths(widths);
    setTabbedPaneWidth(measuredTabbedWidth);
  }, [allResourceTypes]);

  // Get available space for resource types
  const getAvailableSpace = (): number => {
    if (!containerRef.current || !inputRef.current)
      return 0;

    return containerRef.current.offsetWidth -
           inputRef.current.offsetWidth -
           CONTAINER_GAP;
  };

  // Main redistribution logic
  const redistributeElements = React.useCallback(() => {
    const availableWidth = getAvailableSpace();

    if (availableWidth <= 0 || Object.keys(elementWidths).length === 0)
      return;

    // Calculate total width needed including gaps
    const calculateTotalWidth = (resourceTypes: ResourceType[], includeDropdown = false): number => {
      const elementWidthsSum = resourceTypes.reduce((sum, type) =>
        sum + (elementWidths[type] || 0), 0);

      const gapsWidth = Math.max(0, resourceTypes.length - 1) * RESOURCE_TYPE_GAP;
      const dropdownWidth = includeDropdown ? RESOURCE_TYPE_GAP + tabbedPaneWidth : 0;

      return elementWidthsSum + gapsWidth + dropdownWidth;
    };

    // Find maximum visible elements without overflow
    const findMaxVisibleCount = (availableWidth: number): number => {
      let visibleCount = 0;
      for (let i = 0; i <= allResourceTypes.length; i++) {
        const testVisible = allResourceTypes.slice(0, i);
        const widthNeeded = calculateTotalWidth(testVisible, false);

        if (widthNeeded <= availableWidth)
          visibleCount = i;
        else
          break;
      }
      return visibleCount;
    };

    // Adjust visible count to account for dropdown space
    const adjustForDropdown = (visibleCount: number, availableWidth: number): number => {
      if (visibleCount >= allResourceTypes.length)
        return visibleCount;

      while (visibleCount > 0) {
        const visible = allResourceTypes.slice(0, visibleCount);
        const widthWithDropdown = calculateTotalWidth(visible, true);

        if (widthWithDropdown <= availableWidth)
          break;
        visibleCount--;
      }
      return visibleCount;
    };

    let visibleCount = findMaxVisibleCount(availableWidth);
    visibleCount = adjustForDropdown(visibleCount, availableWidth);

    const visible = allResourceTypes.slice(0, visibleCount);
    const overflow = allResourceTypes.slice(visibleCount);

    setVisibleResourceTypes(visible);
    setOverflowResourceTypes(overflow);
  }, [allResourceTypes, elementWidths, tabbedPaneWidth]);

  // Initial measurement and setup
  useEffect(() => {
    measureAllWidths();
  }, [measureAllWidths]);

  // Redistribute when element widths change
  useEffect(() => {
    if (Object.keys(elementWidths).length > 0)
      redistributeElements();
  }, [elementWidths, redistributeElements]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container)
      return;

    const handleResize = () => {
      // Small delay to ensure input has updated width
      setTimeout(redistributeElements, 0);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Initial distribution
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [redistributeElements]);

  // Handle input resize specifically
  useEffect(() => {
    const input = inputRef.current;
    if (!input)
      return;

    const handleInputResize = () => {
      redistributeElements();
    };

    const resizeObserver = new ResizeObserver(handleInputResize);
    resizeObserver.observe(input);

    return () => {
      resizeObserver.disconnect();
    };
  }, [redistributeElements]);

  return (
    <div className='network-filters' ref={containerRef}>
      {/* Hidden element for measurements */}
      <div ref={measurementRef} style={{ position: 'absolute', visibility: 'hidden', top: '-9999px' }} />

      <input
        type='search'
        placeholder='Filter network'
        spellCheck={false}
        ref={inputRef}
        value={filterState.searchValue}
        onChange={e => onFilterStateChange({ ...filterState, searchValue: e.target.value })}
      />

      <div className='network-filters-resource-types' ref={resourceTypesContainerRef}>
        {visibleResourceTypes.map(resourceType => (
          <div
            key={resourceType}
            title={resourceType}
            onClick={() => onFilterStateChange({ ...filterState, resourceType })}
            className={`network-filters-resource-type ${filterState.resourceType === resourceType ? 'selected' : ''}`}
          >
            {resourceType}
          </div>
        ))}
        {overflowResourceTypes.length > 0 && (
          <TabbedPane
            tabs={overflowResourceTypes.reverse().map(resourceType => ({
              id: resourceType,
              title: resourceType,
              render: () => <></>
            }))}
            selectedTab={filterState.resourceType}
            setSelectedTab={tabId => onFilterStateChange({ ...filterState, resourceType: tabId as ResourceType })}
            mode='select'
          />
        )}
      </div>
    </div>
  );
};

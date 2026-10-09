import React from 'react';
import { ClassLegacyPreservationSection } from './ClassLegacyPreservationSection';

interface FoundingClassSectionProps {
  onOpenOnboarding: () => void;
  onExploreDemos: () => void;
}

export const FoundingClassSection: React.FC<FoundingClassSectionProps> = (props) => {
  return <ClassLegacyPreservationSection {...props} />;
};

export { ClassLegacyPreservationSection };

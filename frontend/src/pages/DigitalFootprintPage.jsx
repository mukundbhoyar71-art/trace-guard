import React from 'react';
import { Globe } from 'lucide-react';
import { PagePlaceholder } from '../components/common/PagePlaceholder';

export const DigitalFootprintPage = () => {
  return (
    <PagePlaceholder
      title="Digital Footprint Analyzer"
      subtitle="Public OSINT surface assessment, username reuse detection, and open web profile footprint evaluation."
      icon={Globe}
      phaseNumber="Phase 3"
    />
  );
};


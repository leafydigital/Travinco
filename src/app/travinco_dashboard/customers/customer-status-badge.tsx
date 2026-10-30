'use client';

import { useState, useEffect } from 'react';

interface CustomerStatusBadgeProps {
  customerId: string;
  initialActive: boolean;
  isDeleted?: boolean;
}

export function CustomerStatusBadge({
  customerId,
  initialActive,
  isDeleted = false,
}: CustomerStatusBadgeProps) {
  const [isActive, setIsActive] = useState(initialActive);

  // Sync state if initialActive changes from parent / server refresh
  useEffect(() => {
    setIsActive(initialActive);
  }, [initialActive]);

  // Listen to instant optimistic updates from CustomerRowActions
  useEffect(() => {
    function onStatusChange(e: Event) {
      const customEvent = e as CustomEvent<{ customerId: string; isActive: boolean }>;
      if (customEvent.detail?.customerId === customerId) {
        setIsActive(customEvent.detail.isActive);
      }
    }

    window.addEventListener('travinco:customer-status-changed', onStatusChange);
    return () => {
      window.removeEventListener('travinco:customer-status-changed', onStatusChange);
    };
  }, [customerId]);

  if (isDeleted) {
    return <span className="badge bg-red-100 text-red-700 border-red-200">Deleted</span>;
  }

  return isActive ? (
    <span className="badge badge-success transition-all duration-200">Active</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-800 border-amber-200 transition-all duration-200">
      Deactivated
    </span>
  );
}

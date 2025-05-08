import React, { useState } from 'react';

interface CopyableAddressProps {
  address: string;
  label?: string;
  truncate?: boolean;
}

const CopyableAddress: React.FC<CopyableAddressProps> = ({ 
  address,
  label,
  truncate = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Optionally, provide user feedback on error
    }
  };

  const displayAddress = truncate
    ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    : address;

  return (
    <div className="flex items-center space-x-2 text-xs">
      {label && <span className="font-medium">{label}</span>}
      <span>{displayAddress}</span>
      <button
        onClick={handleCopy}
        title="Copy address"
        className={`p-1 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors 
                    ${copied ? 'text-green-600' : 'text-gray-600 hover:text-gray-800'}`}
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default CopyableAddress; 
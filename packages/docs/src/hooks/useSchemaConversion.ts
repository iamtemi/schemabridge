import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

interface ConvertResponse {
  output: string;
  error?: string;
}

const convertSchema = async (
  schemaCode: string,
  targetLanguage: 'pydantic' | 'typescript',
  zodVersion: '3' | '4',
  signal?: AbortSignal,
): Promise<ConvertResponse> => {
  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaCode,
        targetLanguage,
        zodVersion,
      }),
      signal,
    });

    // Check if response has content
    const text = await response.text();

    if (!text) {
      throw new Error('Empty response from server');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[Client] Failed to parse response:', text);
      throw new Error(`Invalid JSON response from server. Response: ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      const errorMsg = data?.error || `Server error: ${response.status}`;
      console.error('[Client] Server error:', errorMsg);
      throw new Error(errorMsg);
    }

    if (!data.output && !data.error) {
      throw new Error('Response missing output or error field');
    }

    return { output: data.output || '', error: data.error };
  } catch (error: any) {
    console.error('[Client] Conversion request failed:', error);
    // Re-throw to let React Query handle it
    throw error;
  }
};

export const useSchemaConversion = (
  schemaCode: string,
  targetLanguage: 'pydantic' | 'typescript',
  zodVersion: '3' | '4',
) => {
  // Debounce schema code changes - increased to 500ms to reduce loader flashing while typing
  const debouncedSchemaCode = useDebounce(schemaCode, 500);
  // Debounce target language changes - keep fast for dropdowns
  const debouncedTargetLanguage = useDebounce(targetLanguage, 100);
  // Debounce zod version changes - keep fast for dropdowns
  const debouncedZodVersion = useDebounce(zodVersion, 100);

  const { data, error, isPending } = useQuery<ConvertResponse, Error>({
    queryKey: ['convert', debouncedSchemaCode, debouncedTargetLanguage, debouncedZodVersion],
    queryFn: ({ signal }) =>
      convertSchema(debouncedSchemaCode, debouncedTargetLanguage, debouncedZodVersion, signal),
    enabled: debouncedSchemaCode.length > 0,
    // Keep previous data while fetching new data (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  // Only show error if it's from the current query (not a cancelled/stale one)
  const displayError = error instanceof Error ? error.message : null;

  return {
    output: data?.output || '',
    error: displayError,
    // Only show converting state on initial load (when we have no data yet)
    // This prevents loader from flashing while user is typing - we keep showing previous result
    isConverting: isPending && !data,
  };
};

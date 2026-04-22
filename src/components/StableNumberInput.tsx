import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

type StableNumberInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "value" | "onChange"
> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  normalizeValue?: (value: number) => number;
  commitMode?: "blur" | "change";
  debugName?: string;
};

export default function StableNumberInput({
  value,
  onValueChange,
  normalizeValue,
  commitMode = "blur",
  debugName,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: StableNumberInputProps) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const debugEnabled = import.meta.env.DEV && Boolean(debugName);

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(null);
    }
  }, [isFocused, value]);

  const displayedValue =
    draftValue !== null ? draftValue : String(typeof value === "number" ? value : 0);

  useEffect(() => {
    if (!debugEnabled) {
      return;
    }

    console.debug(`[StableNumberInput:${debugName}] render`, {
      storedValue: typeof value === "number" ? value : 0,
      displayedValue,
      isFocused,
    });
  }, [debugEnabled, debugName, displayedValue, isFocused, value]);

  const commitValue = (nextDraftValue: string) => {
    const parsedValue = Number(nextDraftValue || 0);
    const normalizedValue = normalizeValue ? normalizeValue(parsedValue) : parsedValue;

    if (debugEnabled) {
      console.debug(`[StableNumberInput:${debugName}] commit`, {
        rawValue: nextDraftValue,
        storedValue: normalizedValue,
      });
    }

    if ((value ?? 0) !== normalizedValue) {
      onValueChange(normalizedValue);
    }
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayedValue}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const sanitizedValue = event.target.value.replace(/[^\d]/g, "");

        if (debugEnabled) {
          console.debug(`[StableNumberInput:${debugName}] input`, {
            rawValue: event.target.value,
            storedValue: typeof value === "number" ? value : 0,
            displayedValue: sanitizedValue,
          });
        }

        setDraftValue(sanitizedValue);

        if (commitMode === "change") {
          commitValue(sanitizedValue);
        }
      }}
      onBlur={(event) => {
        setIsFocused(false);

        if (draftValue !== null) {
          if (commitMode === "blur") {
            commitValue(draftValue);
          }

          setDraftValue(null);
        }

        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        onKeyDown?.(event);
      }}
    />
  );
}

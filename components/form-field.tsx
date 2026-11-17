// Generic text input wired to react-hook-form's Controller.
// Pass any TextInput prop through; just needs `name` + `control` + `label`.

import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { palette } from "@/lib/tokens";

interface FormFieldProps<T extends FieldValues>
  extends Omit<TextInputProps, "value" | "onChangeText"> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  error?: string;
}

export function FormField<T extends FieldValues>({
  name,
  label,
  control,
  error,
  ...rest
}: FormFieldProps<T>) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm text-bone">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholderTextColor={palette.boneFaint}
            className={`rounded-md border bg-lair-700 px-4 py-3 text-bone ${
              error ? "border-danger" : "border-hairline"
            }`}
            {...rest}
          />
        )}
      />
      {error && <Text className="mt-1 text-sm text-danger">{error}</Text>}
    </View>
  );
}

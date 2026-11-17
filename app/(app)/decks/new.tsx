// Deck creation wizard — step 1: format + name + commander (if needed)
// + optional import.
//
// One-shot deck creation: everything is held in local state until the
// user clicks "Create deck", then we POST /decks/ ONCE with the full
// payload (commander included when relevant). No follow-up calls,
// no commander-update endpoint — just the existing create contract,
// which already accepts a `commander` field in CreateDeckRequest.
//
// Submission paths:
//   1. import text present → POST /decks/import (commander parsed from
//      the // Commander section of the pasted list)
//   2. otherwise            → POST /decks/ with `commander` baked in
//
// On success, replace-navigate to /decks/[id]/build (or /decks/[id]
// for imports, since they already have a full card list).

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";

import { CardTile } from "@/components/card-tile";
import { Chip } from "@/components/filter-chips";
import { FormField } from "@/components/form-field";
import { PageContent } from "@/components/page-content";
import { useSearchCards, type CardDto } from "@/lib/queries/cards";
import { useCreateDeck, useImportDeck } from "@/lib/queries/decks";
import { alpha, palette, radii } from "@/lib/tokens";

// ---------- Format options ----------
//
// Popular formats shown first; the rest hide behind a "More formats"
// toggle so the picker doesn't dump 23 options on the user up front.

interface FormatOption {
  code: string;
  label: string;
}

const POPULAR_FORMATS: FormatOption[] = [
  { code: "COMMANDER", label: "Commander" },
  { code: "STANDARD", label: "Standard" },
  { code: "MODERN", label: "Modern" },
  { code: "PAUPER", label: "Pauper" },
  { code: "LEGACY", label: "Legacy" },
];

const OTHER_FORMATS: FormatOption[] = [
  { code: "PIONEER", label: "Pioneer" },
  { code: "VINTAGE", label: "Vintage" },
  { code: "BRAWL", label: "Brawl" },
  { code: "STANDARD_BRAWL", label: "Standard Brawl" },
  { code: "HISTORIC_BRAWL", label: "Historic Brawl" },
  { code: "PAUPER_COMMANDER", label: "Pauper Commander" },
  { code: "HISTORIC", label: "Historic" },
  { code: "ALCHEMY", label: "Alchemy" },
  { code: "EXPLORER", label: "Explorer" },
  { code: "TIMELESS", label: "Timeless" },
  { code: "PENNY", label: "Penny" },
  { code: "GLADIATOR", label: "Gladiator" },
  { code: "OATHBREAKER", label: "Oathbreaker" },
  { code: "DUEL", label: "Duel Commander" },
  { code: "OLDSCHOOL", label: "Old School" },
  { code: "PREMODERN", label: "Premodern" },
  { code: "FUTURE", label: "Future Standard" },
  { code: "PRE_DH", label: "Pre-DH" },
];

// Formats that need a commander/face card.
const COMMANDER_FORMATS = new Set([
  "COMMANDER",
  "BRAWL",
  "STANDARD_BRAWL",
  "HISTORIC_BRAWL",
  "PAUPER_COMMANDER",
  "OATHBREAKER",
  "DUEL",
]);

// ---------- Form ----------

const schema = z.object({
  format: z.string().min(1, "Pick a format"),
  name: z.string().trim().min(1, "Give your deck a name").max(120, "Too long"),
  description: z.string().max(2000).optional().or(z.literal("")),
  deckText: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export default function NewDeckScreen() {
  const router = useRouter();
  const createDeck = useCreateDeck();
  const importDeck = useImportDeck();

  const [showMoreFormats, setShowMoreFormats] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Commander selection lives in local state until submit; never written
  // to the backend independently.
  const [commander, setCommander] = useState<CardDto | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      format: "",
      name: "",
      description: "",
      deckText: "",
    },
  });

  const format = watch("format");
  const deckText = watch("deckText") ?? "";
  const hasImportText = deckText.trim().length > 0;
  const needsCommander = COMMANDER_FORMATS.has(format) && !hasImportText;
  const submitting = createDeck.isPending || importDeck.isPending;

  // Clear the commander when the user switches away from a commander format
  // (avoids a stale selection going stale silently).
  useEffect(() => {
    if (!COMMANDER_FORMATS.has(format) && commander) {
      setCommander(null);
    }
  }, [format, commander]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    if (needsCommander && !commander) {
      setSubmitError("Pick a commander before creating this deck.");
      return;
    }

    try {
      const deck = hasImportText
        ? await importDeck.mutateAsync({
            format: values.format,
            name: values.name.trim(),
            description: values.description || undefined,
            deck_text: values.deckText!,
          })
        : await createDeck.mutateAsync({
            format: values.format,
            name: values.name.trim(),
            description: values.description || undefined,
            commander: commander
              ? { card_id: commander.id, count: 1 }
              : undefined,
            cards: [],
          });
      // Import flow → straight to detail (deck already populated).
      // Empty deck → step 2 (the build page) so the user can add cards.
      const target = hasImportText
        ? `/decks/${deck.id}`
        : `/decks/${deck.id}/build`;
      router.replace(target as any);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't create the deck.";
      setSubmitError(msg);
    }
  };

  const canSubmit = !needsCommander || commander !== null;

  return (
    // KeyboardAvoidingView wraps the form so focused inputs (deck name,
    // description, import textarea, search) stay visible above the on-screen
    // keyboard on mobile. iOS uses "padding"; Android relies on its native
    // window soft-input mode; web no-ops.
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 64 }}
        keyboardShouldPersistTaps="handled"
      >
        <PageContent style={{ padding: 24 }}>
          <Pressable
            onPress={() => router.back()}
            className="mb-3 self-start rounded-md px-2 py-1 hover:bg-lair-700 active:bg-lair-700"
          >
            <Text className="text-sm text-hoard-gold">← Back</Text>
          </Pressable>

          <Text className="font-brand text-3xl text-hoard-gold">New deck</Text>
          <Text className="mt-1 mb-6 text-bone-dim">
            Pick a format and give it a name. You can paste a decklist now
            or start empty and add cards later.
          </Text>

          {/* ---------- Format ---------- */}
          <SectionHeader title="Format" required />
          <Controller
            control={control}
            name="format"
            render={({ field: { value, onChange } }) => (
              <>
                <ChipRow
                  options={POPULAR_FORMATS}
                  selected={value}
                  onSelect={onChange}
                />
                <Pressable
                  onPress={() => setShowMoreFormats((o) => !o)}
                  className="mt-3 self-start"
                >
                  <Text className="text-xs text-hoard-gold">
                    {showMoreFormats ? "Show fewer" : "More formats →"}
                  </Text>
                </Pressable>
                {showMoreFormats && (
                  <View className="mt-3">
                    <ChipRow
                      options={OTHER_FORMATS}
                      selected={value}
                      onSelect={onChange}
                    />
                  </View>
                )}
              </>
            )}
          />
          {errors.format && (
            <Text className="mt-2 text-sm text-danger">
              {errors.format.message}
            </Text>
          )}

          {/* ---------- Commander (conditional) ---------- */}
          {needsCommander && (
            <View className="mt-8">
              <CommanderPicker
                selected={commander}
                onSelect={setCommander}
                onClear={() => setCommander(null)}
              />
            </View>
          )}

          {/* ---------- Name + description ---------- */}
          <View className="mt-8">
            <FormField
              control={control}
              name="name"
              label="Deck name"
              placeholder="e.g. Atraxa, Praetors' Voice"
              autoCapitalize="words"
              autoCorrect={false}
              error={errors.name?.message}
            />

            <FormField
              control={control}
              name="description"
              label="Description (optional)"
              placeholder="What's the gameplan? Notes for collaborators?"
              multiline
              numberOfLines={3}
              style={{
                minHeight: 80,
                textAlignVertical: "top",
                paddingTop: 12,
              }}
              error={errors.description?.message}
            />
          </View>

          {/* ---------- Import (collapsible) ---------- */}
          <Pressable
            onPress={() => setShowImport((o) => !o)}
            className="mt-2 flex-row items-center rounded-md border border-hairline bg-lair-700 px-4 py-3 hover:bg-hairline/30 active:bg-hairline/30"
          >
            <Text className="flex-1 text-bone">
              Import an existing decklist
            </Text>
            <Text className="text-xs text-hoard-gold">
              {showImport ? "Hide" : "Show"}
            </Text>
          </Pressable>

          {showImport && (
            <View className="mt-3">
              <Text className="mb-2 text-xs text-bone-dim">
                Paste a list in Moxfield / Scryfall format. Use{" "}
                <Text className="text-bone">// Sideboard</Text> /{" "}
                <Text className="text-bone">// Commander</Text>{" "}
                markers for sections. Lines that don&apos;t resolve to a
                card will fail the whole import (strict mode).
              </Text>
              <FormField
                control={control}
                name="deckText"
                label="Decklist"
                placeholder={
                  "1 Sol Ring\n1 Command Tower\n// Commander\n1 Atraxa, Praetors' Voice"
                }
                multiline
                numberOfLines={10}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  minHeight: 200,
                  textAlignVertical: "top",
                  paddingTop: 12,
                  fontFamily: Platform.select({
                    web: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    default: "Courier",
                  }),
                  fontSize: 13,
                }}
                error={errors.deckText?.message}
              />
            </View>
          )}

          {/* ---------- Submit ---------- */}
          {submitError && (
            <View className="mt-4 rounded-md bg-danger/20 p-3">
              <Text className="text-sm text-danger">{submitError}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={submitting || !canSubmit}
            className={`mt-6 items-center rounded-md py-3 ${
              submitting || !canSubmit ? "bg-hoard-gold/40" : "bg-hoard-gold"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color={palette.lair900} />
            ) : (
              <Text className="font-semibold text-lair-900">
                {hasImportText ? "Import deck" : "Create deck"}
              </Text>
            )}
          </Pressable>

          {needsCommander && !commander && (
            <Text className="mt-2 text-center text-xs text-bone-dim">
              Pick a commander above to enable creation.
            </Text>
          )}
        </PageContent>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- Commander picker ----------

function CommanderPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: CardDto | null;
  onSelect: (card: CardDto) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const search = useSearchCards({
    name: debounced.length > 0 ? debounced : undefined,
    size: 8,
  });
  const cards = search.data?.content ?? [];

  // Selected state: show the chosen commander prominently with a clear button.
  if (selected) {
    return (
      <View>
        <SectionHeader title="Commander" required />
        <View
          className="flex-row items-center rounded-md border border-hoard-gold/40 bg-hoard-gold/5 p-3"
          style={{ gap: 12 }}
        >
          <CardTile card={selected} mode="carousel" width={88} />
          <View style={{ flex: 1 }}>
            <Text
              className="font-semibold text-bone"
              numberOfLines={1}
            >
              {selected.name}
            </Text>
            {selected.default_face?.full_type && (
              <Text className="mt-0.5 text-xs text-bone-dim" numberOfLines={1}>
                {selected.default_face.full_type}
              </Text>
            )}
            <Pressable
              onPress={onClear}
              className="mt-2 self-start rounded-md border border-hairline px-3 py-1 hover:bg-lair-700 active:bg-lair-700"
            >
              <Text className="text-xs text-hoard-gold">Change</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Search state: input + results grid; click a card to select.
  return (
    <View>
      <SectionHeader title="Commander" required />
      <Text className="mb-3 text-xs text-bone-dim">
        Pick a legendary creature (or any &quot;can be your commander&quot;
        card) to lead the deck.
      </Text>

      <View
        className="flex-row items-center rounded-full border border-hairline bg-lair-700"
        style={{ paddingHorizontal: 14, height: 44 }}
      >
        <Ionicons
          name="search"
          size={18}
          color={query ? palette.hoardGold : palette.boneDim}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for your commander…"
          placeholderTextColor={palette.boneDim}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            marginLeft: 10,
            color: palette.bone,
            fontSize: 15,
            paddingVertical: 0,
            ...(Platform.OS === "web"
              ? ({ outlineStyle: "none" } as object)
              : {}),
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={palette.boneDim} />
          </Pressable>
        )}
      </View>

      {search.isLoading && (
        <View className="mt-3 items-center py-4">
          <ActivityIndicator size="small" color={palette.hoardGold} />
        </View>
      )}

      {!search.isLoading && query.length > 0 && cards.length === 0 && (
        <View className="mt-3 rounded-md border border-hairline bg-lair-700 p-3">
          <Text className="text-sm text-bone-dim">No cards matched.</Text>
        </View>
      )}

      {cards.length > 0 && (
        <View
          className="mt-4 flex-row flex-wrap"
          style={{ gap: 12 }}
        >
          {cards.map((card) => (
            // CardTile already wraps in a Pressable. Wrapping in another
            // outer Pressable means the inner one swallows the click —
            // pass onPress to CardTile directly so the whole tile is the
            // single press target.
            <View key={card.id} style={{ width: 120 }}>
              <View style={{ position: "relative" }}>
                <CardTile
                  card={card}
                  mode="carousel"
                  width={120}
                  onPress={() => onSelect(card)}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 26,
                    height: 26,
                    borderRadius: radii.full,
                    backgroundColor: alpha(palette.hoardGold, 0.95),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="ribbon" size={14} color={palette.lair900} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- Bits ----------

function SectionHeader({
  title,
  required,
}: {
  title: string;
  required?: boolean;
}) {
  return (
    <View className="mb-3 flex-row items-baseline" style={{ gap: 6 }}>
      <Text className="text-xs uppercase tracking-wider text-bone-dim">
        {title}
      </Text>
      {required && <Text className="text-xs text-danger">*</Text>}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: FormatOption[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((opt) => (
        <Chip
          key={opt.code}
          label={opt.label}
          selected={selected === opt.code}
          onPress={() => onSelect(opt.code)}
        />
      ))}
    </View>
  );
}

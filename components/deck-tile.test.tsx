import { render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { DeckTile } from '@/components/deck-tile';
import type { DeckDto } from '@/lib/queries/decks';

const deck: DeckDto = { id: 'deck-9', name: 'Mono Red', colors: ['R'] };

test("the strip's control is beside the cover's button, not inside it", () => {
  render(
    <DeckTile
      deck={deck}
      footer={
        <Pressable accessibilityRole="togglebutton" accessibilityLabel="Favorite Mono Red">
          <Text>★</Text>
        </Pressable>
      }
    />
  );

  const cover = screen.getByRole('button', { name: 'Mono Red' });
  // A control inside an accessible parent isn't offered on its own by VoiceOver.
  expect(within(cover).queryByRole('togglebutton')).toBeNull();
  expect(screen.getByRole('togglebutton', { name: 'Favorite Mono Red' })).toBeTruthy();
});

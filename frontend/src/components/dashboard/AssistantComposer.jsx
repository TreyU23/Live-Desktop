import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { SectionHeader } from './SectionHeader.jsx';
import { icons } from '../ui/icons.js';

// Suggestions only fill the field; nothing is sent until the user presses Send.
const kSuggestions = ['How is my PC doing?', 'Turn off Bluetooth', 'What’s on my calendar today?'];

export function AssistantComposer({ onSubmit, busy, providerName = 'OpenAI' }) {
  const [value, setValue] = useState('');
  const sending = useRef(false);
  const submit = async () => {
    if (!value.trim() || busy || sending.current) return;
    sending.current = true;
    const sent = value;
    try { if (await onSubmit(sent.trim())) setValue(current => current === sent ? '' : current); }
    finally { sending.current = false; }
  };
  return <VStack as="section" gap={2} aria-labelledby="ask-title">
    <SectionHeader id="ask-title" title="Ask Live Desktop" />
    <HStack gap={2} vAlign="center">
      <StackItem size="fill">
        <TextInput label="Ask your assistant" isLabelHidden placeholder="Ask about this PC or request a change" value={value} onChange={setValue} onEnter={submit} />
      </StackItem>
      <Button label="Send" variant="primary" icon={<Icon icon={icons.Send} />} isLoading={busy} isDisabled={!value.trim()} onClick={submit} />
    </HStack>
    <HStack gap={2} wrap="wrap" role="group" aria-label="Suggestions">
      {kSuggestions.map(text => <Button key={text} label={text} size="sm" onClick={() => setValue(text)} />)}
    </HStack>
    <Text type="supporting">Anything that changes your PC asks for approval first. History stays in this local profile; assistant requests are sent to {providerName}.</Text>
  </VStack>;
}

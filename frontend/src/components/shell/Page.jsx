import { Layout, LayoutContent, LayoutHeader, HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';

// Page frame shared by every view: heading row (title, detail, actions), then content.
// AppShell owns the <main> landmark; views never render their own.
export function Page({ title, detail, actions, status, children, padding = 6, contentWidth }) {
  return <Layout height="auto" contentWidth={contentWidth}
    header={<LayoutHeader padding={padding} paddingBlockEnd={0}>
      <HStack gap={4} vAlign="start" wrap="wrap">
        <StackItem size="fill">
          <VStack gap={1}>
            <Heading level={1}>{title}</Heading>
            {detail ? <Text type="supporting">{detail}</Text> : null}
            {status}
          </VStack>
        </StackItem>
        {actions}
      </HStack>
    </LayoutHeader>}
    content={<LayoutContent padding={padding}>{children}</LayoutContent>} />;
}

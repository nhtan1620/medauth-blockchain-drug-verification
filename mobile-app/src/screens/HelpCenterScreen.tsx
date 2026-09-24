import React, { useState } from 'react';
import { ScrollView, SafeAreaView, StyleSheet, Text, Pressable, View } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does "Counterfeit suspected" mean?',
    a: 'The pack failed one or more integrity checks — for example it is past its expiry date, or the same serial number has already been dispensed elsewhere. Do not dispense it, and use "Report to Regulator" from the result screen.',
  },
  {
    q: 'What does "Barcode not found" mean?',
    a: "This pack's identifier has never been recorded on the ledger by a manufacturer. It could be an unregistered product, a damaged barcode, or a counterfeit — treat it with caution and re-scan to rule out a misread.",
  },
  {
    q: 'Why do I need to be online to verify?',
    a: 'A live check confirms the pack against the latest ledger state. If you are offline, MedAuth queues your scan and verifies it automatically once connectivity returns — usually within a few minutes.',
  },
  {
    q: 'Is any of my personal data stored on the blockchain?',
    a: 'No. MedAuth follows a zero-PII-on-chain design: only pack identifiers and lifecycle events are on the ledger. Anything sensitive is kept off-chain and only a cryptographic hash is anchored on-chain.',
  },
  {
    q: 'How do I report a suspected counterfeit?',
    a: 'From the Result screen, tap "Report to Regulator". Your report references the pack\'s SGTIN and event trail — no need to attach personal information.',
  },
];

export function HelpCenterScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Help Center</Text>
        <Text style={styles.subtitle}>Common questions about scanning and verification results.</Text>

        {FAQ.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <Pressable
              key={item.q}
              style={styles.card}
              onPress={() => setOpenIndex(isOpen ? null : idx)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.question}>{item.q}</Text>
                <Text style={styles.chevron}>{isOpen ? '−' : '+'}</Text>
              </View>
              {isOpen ? <Text style={styles.answer}>{item.a}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { ...typography.body, fontWeight: '600', color: colors.textPrimary, flex: 1, paddingRight: spacing.sm },
  chevron: { ...typography.h2, color: colors.primary },
  answer: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
});

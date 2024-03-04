import React from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {ComAtprotoLabelDefs} from '@atproto/api'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import * as Dialog from '#/components/Dialog'
import {Button} from '#/components/Button'
import {capitalize} from '#/lib/strings/capitalize'

export {useDialogControl as useLabelsOnMeDialogControl} from '#/components/Dialog'

type Subject =
  | {
      uri: string
      cid: string
    }
  | {
      did: string
    }

export interface LabelsOnMeDialogProps {
  control: Dialog.DialogOuterProps['control']
  subject: Subject
  labels: ComAtprotoLabelDefs.Label[]
}

export function LabelsOnMeDialogInner(props: LabelsOnMeDialogProps) {
  const t = useTheme()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {subject, labels} = props
  const isAccount = 'did' in subject

  // TODO
  // const submit = async () => {
  //   try {
  //     const $type = !isAccountReport
  //       ? 'com.atproto.repo.strongRef'
  //       : 'com.atproto.admin.defs#repoRef'
  //     await getAgent().createModerationReport({
  //       reasonType: ComAtprotoModerationDefs.REASONAPPEAL,
  //       subject: {
  //         $type,
  //         ...props,
  //       },
  //       reason: details,
  //     })
  //     Toast.show(_(msg`We'll look into your appeal promptly.`))
  //   } finally {
  //     closeModal()
  //   }
  // }

  return (
    <Dialog.ScrollableInner
      accessibilityDescribedBy="dialog-description"
      accessibilityLabelledBy="dialog-title">
      <Text
        nativeID="dialog-title"
        style={[a.text_2xl, a.font_bold, a.pb_md, a.leading_tight]}>
        <Trans>
          The following labels were applied to your{' '}
          {isAccount ? 'account' : 'content'}
        </Trans>
      </Text>
      <Text nativeID="dialog-description" style={[a.text_md, a.leading_snug]}>
        <Trans>
          You may appeal these labels if you feel they were placed in error.
        </Trans>
      </Text>

      <View style={[a.py_lg, a.gap_md]}>
        {labels.map(label => (
          <View
            key={`${label.src}-${label.val}`}
            style={[a.p_md, a.rounded_sm, t.atoms.bg_contrast_25]}>
            <Text>{capitalize(label.val)}</Text>
          </View>
        ))}
      </View>

      <View style={gtMobile && [a.flex_row, a.justify_end]}>
        <Button
          testID="doneBtn"
          variant="outline"
          color="primary"
          size="small"
          onPress={() => props.control.close()}
          label={_(msg`Done`)}>
          {_(msg`Done`)}
        </Button>
      </View>
    </Dialog.ScrollableInner>
  )
}

export function LabelsOnMeDialog(props: LabelsOnMeDialogProps) {
  return (
    <Dialog.Outer control={props.control}>
      <Dialog.Handle />

      <LabelsOnMeDialogInner {...props} />
    </Dialog.Outer>
  )
}
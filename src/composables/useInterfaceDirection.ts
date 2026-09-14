import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { getLangDirection } from '@shared/utils/locale'
import {
  unstableScrollbarRtl,
  unstableAlertRtl,
  unstableButtonGroupRtl,
  unstableButtonRtl,
  unstableCardRtl,
  unstableCheckboxRtl,
  unstableCollapseTransitionRtl,
  unstableCollapseRtl,
  unstableDataTableRtl,
  unstableDialogRtl,
  unstableDrawerRtl,
  unstableInputNumberRtl,
  unstableInputRtl,
  unstableListRtl,
  unstableMessageRtl,
  unstablePaginationRtl,
  unstablePopoverRtl,
  unstableRadioRtl,
  unstableSelectRtl,
  unstableSpaceRtl,
  unstableTableRtl,
  unstableTagRtl,
  unstableTreeRtl,
} from 'naive-ui'

// Use the library's exported RTL styles rather than duplicating control geometry.
const rtlStyles = [
  unstableScrollbarRtl,
  unstableAlertRtl,
  unstableButtonGroupRtl,
  unstableButtonRtl,
  unstableCardRtl,
  unstableCheckboxRtl,
  unstableCollapseTransitionRtl,
  unstableCollapseRtl,
  unstableDataTableRtl,
  unstableDialogRtl,
  unstableDrawerRtl,
  unstableInputNumberRtl,
  unstableInputRtl,
  unstableListRtl,
  unstableMessageRtl,
  unstablePaginationRtl,
  unstablePopoverRtl,
  unstableRadioRtl,
  unstableSelectRtl,
  unstableSpaceRtl,
  unstableTableRtl,
  unstableTagRtl,
  unstableTreeRtl,
]
export function useInterfaceDirection() {
  const { locale } = useI18n()
  const direction = computed(() => getLangDirection(locale.value))
  watchEffect(() => {
    document.documentElement.dir = direction.value
    document.documentElement.lang = locale.value
  })
  return computed(() => (direction.value === 'rtl' ? rtlStyles : undefined))
}

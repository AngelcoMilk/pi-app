export type ExtensionUIDismissReason =
  | 'abort'
  | 'answered'
  | 'compaction'
  | 'timeout'
  | 'session-replaced'
  | 'worker-exit'
  | 'worker-dispose'

export type ExtensionUIQuestionOption = {
  label: string
  description?: string
  hasPreview?: boolean
  preview?: string
}

export type ExtensionUIQuestion = {
  question: string
  header?: string
  multiSelect?: boolean
  options: ExtensionUIQuestionOption[]
}

export type ExtensionUIQuestionAnswer = {
  questionIndex: number
  question: string
  kind: 'option' | 'custom' | 'multi'
  answer: string | null
  selected?: string[]
}

export type ExtensionUIQuestionnaireResult = {
  cancelled: boolean
  answers: ExtensionUIQuestionAnswer[]
}

export type ExtensionUIRequest =
  | { id: string; method: 'select'; title: string; options: string[]; timeout?: number }
  | { id: string; method: 'confirm'; title: string; message: string; timeout?: number }
  | { id: string; method: 'input'; title: string; placeholder?: string; timeout?: number }
  | { id: string; method: 'editor'; title: string; prefill?: string }
  | { id: string; method: 'notify'; message: string; notifyType?: 'info' | 'warning' | 'error' }
  | {
      id: string
      method: 'custom'
      kind: 'ask_user_question'
      toolCallId?: string
      questions: ExtensionUIQuestion[]
    }
  | {
      id: string
      method: 'custom'
      kind: 'image_review'
      image: string
      title: string
      question: string
      context?: string
      options: string[]
      allowFeedback: boolean
    }

export type ExtensionUIInteractiveRequest = Exclude<ExtensionUIRequest, { method: 'notify' }>

export type ExtensionUIPendingRequest = ExtensionUIInteractiveRequest & {
  sessionFile: string
  createdAt: number
}

export type ExtensionUIResponse = {
  id: string
  value?: string
  confirmed?: boolean
  cancelled?: boolean
  result?: unknown
}

export type ExtensionUIResponseResult = {
  ok: boolean
  error?: 'request-not-found' | 'worker-rejected'
}

export type ExtensionUIDismissEvent = {
  type: 'extension-ui-dismiss' | 'extension-ui-dismiss-all'
  id?: string
  sessionFile: string
  reason: ExtensionUIDismissReason
}

export function isInteractiveExtensionUIRequest(
  request: ExtensionUIRequest,
): request is ExtensionUIInteractiveRequest {
  return request.method !== 'notify'
}

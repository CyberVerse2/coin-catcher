// ModalContainer.tsx
import React, { FC } from 'react'
import ReactDOM from 'react-dom'

export type ModalType = 'alert' | 'confirm' | 'success' | 'error' | 'custom'

export interface CustomButton {
  text: string
  onClick: () => void
  primary?: boolean
}

export interface ModalProps {
  type?: ModalType
  title?: string
  message?: string
  okText?: string
  cancelText?: string
  customButtons?: CustomButton[]
  onClose: (result?: any) => void
}

const ModalContainer: FC<ModalProps> = ({
  type = 'alert',
  title,
  message,
  onClose,
  okText,
  cancelText,
  customButtons,
}) => {
  const buttons =
    customButtons ??
    (type === 'confirm'
      ? [
          { text: cancelText || 'Cancel', onClick: () => onClose(false) },
          { text: okText || 'OK', onClick: () => onClose(true), primary: true },
        ]
      : [
          { text: okText || 'OK', onClick: () => onClose(undefined), primary: true },
        ])

  const bgClass =
    type === 'success'
      ? 'bg-green-100'
      : type === 'error'
      ? 'bg-red-100'
      : 'bg-white'
  const textClass =
    type === 'success'
      ? 'text-green-800'
      : type === 'error'
      ? 'text-red-800'
      : 'text-gray-800'

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={() => onClose(type === 'confirm' ? false : undefined)}
      />
      {/* stacked outlines + content */}
      <div className="relative z-10 w-11/12 max-w-md">
        <div className="absolute top-2 left-2 right-0 bottom-0 border-2 border-blue-300 rounded-lg" />
        <div className="absolute top-4 left-4 right-0 bottom-0 border-2 border-blue-400 rounded-lg" />

        <div className={`relative p-6 rounded-lg shadow-lg ${bgClass}`}>
          {title && (
            <h3 className={`text-xl font-semibold mb-4 ${textClass}`}>
              {title}
            </h3>
          )}
          {message && <p className="mb-6 text-gray-700">{message}</p>}

          <div className="flex justify-end space-x-2">
            {buttons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.onClick}
                className={`px-4 py-2 rounded transition ${
                  btn.primary
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {btn.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ModalContainer

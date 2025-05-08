// ModalContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import ModalContainer from '../components/modalContainer';

export type ModalType = 'alert' | 'confirm' | 'success' | 'error' | 'custom';

export interface CustomButton {
  text: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ModalOptions {
  type?: ModalType;
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
  customButtons?: CustomButton[];
}

// Internally we tack on a resolve fn
interface InternalModalOptions extends ModalOptions {
  resolve: (value?: any) => void;
}

interface ModalContextValue {
  showModal: (opts: ModalOptions) => Promise<any>;
  alert: (message: string, opts?: Omit<ModalOptions, 'message' | 'type'>) => Promise<void>;
  confirm: (message: string, opts?: Omit<ModalOptions, 'message' | 'type'>) => Promise<boolean>;
  success: (message: string, opts?: Omit<ModalOptions, 'message' | 'type'>) => Promise<void>;
  error: (message: string, opts?: Omit<ModalOptions, 'message' | 'type'>) => Promise<void>;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const useModal = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be inside a ModalProvider');
  return ctx;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalOpts, setModalOpts] = useState<InternalModalOptions | null>(null);

  const showModal = useCallback((opts: ModalOptions) => {
    return new Promise<any>((resolve) => {
      setModalOpts({ ...opts, resolve });
    });
  }, []);

  // hide & resolve
  const hideModal = useCallback(
    (result?: any) => {
      modalOpts?.resolve(result);
      setModalOpts(null);
    },
    [modalOpts]
  );

  const alert = useCallback(
    (message: string, config?: Omit<ModalOptions, 'message' | 'type'>) =>
      showModal({ type: 'alert', message, ...config }),
    [showModal]
  );
  const confirm = useCallback(
    (message: string, config?: Omit<ModalOptions, 'message' | 'type'>) =>
      showModal({ type: 'confirm', message, ...config }),
    [showModal]
  );
  const success = useCallback(
    (message: string, config?: Omit<ModalOptions, 'message' | 'type'>) =>
      showModal({ type: 'success', message, ...config }),
    [showModal]
  );
  const error = useCallback(
    (message: string, config?: Omit<ModalOptions, 'message' | 'type'>) =>
      showModal({ type: 'error', message, ...config }),
    [showModal]
  );

  // ONLY strip off `resolve` before passing to ModalContainer
  let modalElement: React.ReactNode = null;
  if (modalOpts) {
    const { resolve, ...publicOpts } = modalOpts;
    // publicOpts is now exactly ModalOptions
    modalElement = <ModalContainer {...publicOpts} onClose={hideModal} />;
  }

  return (
    <ModalContext.Provider value={{ showModal, alert, confirm, success, error }}>
      {children}
      {modalElement}
    </ModalContext.Provider>
  );
};

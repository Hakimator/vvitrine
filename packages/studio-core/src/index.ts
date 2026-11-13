/**
 * @vvitrine/studio-core: what the Studio does, without any framework (ADR-015). It turns the site's editing model
 * into forms; the Studio's user interface and its adapters (files on disk, a Git repository) build on it.
 */
export {
  describeContent,
  describeOptions,
  humanise,
  itemTitle,
  type FieldDescriptor,
  type FieldKind,
  type FieldPath,
} from './fields.ts';
export { invert } from './history.ts';
export {
  EditSession,
  SaveBlockedError,
  type DocumentChange,
  type DocumentChecker,
  type DocumentId,
  type DocumentIssue,
  type DocumentStore,
  type SessionDocument,
  type UndoneStep,
} from './session.ts';

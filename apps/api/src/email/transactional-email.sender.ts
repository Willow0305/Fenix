export interface TransactionalEmail {
  readonly recipient: string;
  readonly subject: string;
  readonly text: string;
}

export abstract class TransactionalEmailSender {
  public abstract send(message: TransactionalEmail): Promise<void>;
}

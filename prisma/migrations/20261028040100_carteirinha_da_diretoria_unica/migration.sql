-- Uma carteirinha de diretoria por pessoa (separado: o valor novo do enum só vale após o commit).
CREATE UNIQUE INDEX "member_cards_board_holder_key"
  ON "member_cards"("holder_user_id") WHERE "type" = 'BOARD';

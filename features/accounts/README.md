# Accounts

Money holders: list, detail, create/edit, main account, archive/restore and balance adjustments.
W-13 ships creation for onboarding; W-23/W-24 add the rest.

`AccountPicker` (W-16) is the shared account selector: a `Picker` that opens a sheet listing the
active accounts with their type tile, "Main" badge and live balance. `exclude` hides one account so
the two sides of a transfer can never be the same; archived accounts are not offered.

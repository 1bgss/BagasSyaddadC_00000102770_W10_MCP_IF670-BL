import { createSlice } from "@reduxjs/toolkit";

const counterSlice = createSlice({
  name: "counter",

  initialState: {
    successCount: 0,
    failedCount: 0,
  },

  reducers: {
    incrementSuccess: (state) => {
      state.successCount += 1;
    },

    incrementFailed: (state) => {
      state.failedCount += 1;
    },
  },
});

export const {
  incrementSuccess,
  incrementFailed,
} = counterSlice.actions;

export default counterSlice.reducer;
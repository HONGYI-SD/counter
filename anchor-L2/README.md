# solana layer2 program

- 为 summary 账户分配10MB空间，大概耗时8min。
- 每次可扩展的内存 MAX_PERMITTED_DATA_INCREASE = 10240

- 如果你在账户结构体上使用了 #[instruction(index: u32)] 这样的宏，这意味着 index 参数需要在其他参数之前进行处理。如果参数顺序不符合这种依赖关系，Anchor 就会无法正确解析这些参数，导致程序运行异常。